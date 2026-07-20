/**
 * guard-financial-duplication.mjs — CI guardrail (Phase 2.2 Wave 4).
 *
 * Fails (exit 1) if any runtime reintroduces LOCAL financial math instead of
 * delegating to the Financial Projection Engine. Enforces the Phase 2.2
 * invariant: **business logic exists exactly once** (1 TS engine + 1 SQL mirror).
 *
 * It scans the Node backend and the Deno edge functions, skips the canonical
 * locations (engine source/dist, vendored copy, SQL mirror, the thin adapter),
 * and — crucially — strips the generated `FPE-ENGINE-INLINE` blocks from edge
 * files before scanning (that inlined engine legitimately contains the patterns).
 *
 * Run:  node kolekto-shared-financial/scripts/guard-financial-duplication.mjs
 *       (or `npm run guard` from the package)
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");            // kolekto-shared-financial
const feRoot = resolve(pkgRoot, "..");          // kolekto-fe-old
const codebase = resolve(feRoot, "..");         // Kolekto-codebase
const beRoot = join(codebase, "kolekto-be-old");

// Roots to scan (the three-runtime surface, minus canonical locations).
const SCAN_ROOTS = [
  join(beRoot, "controllers"),
  join(beRoot, "services"),
  join(beRoot, "routes"),
  join(beRoot, "jobs"),
  join(beRoot, "utils"),
  join(feRoot, "supabase", "functions"),
].filter(existsSync);

// Canonical / allowed paths — the ONE place each rule may live.
const ALLOW = [
  join(pkgRoot),                                       // the engine itself
  join(beRoot, "utils", "fpe"),                        // vendored engine (generated)
  join(beRoot, "utils", "financial.js"),               // thin adapter (re-exports only)
  join(beRoot, "database", "settlement_recompute.sql"),// SQL mirror
  join(beRoot, "tests"),                               // characterization tests
].map((p) => resolve(p));

const BEGIN = ">>> FPE-ENGINE-INLINE";
const END = "<<< FPE-ENGINE-INLINE";

// Forbidden re-implementations. `reverseCalculateContribution` is intentionally
// NOT here — it is a sanctioned edge-local estimator (Wave 2 R-REV).
const RULES = [
  { name: "roundCurrency redefinition", re: /\bfunction\s+roundCurrency\b/ },
  { name: "calculateFees redefinition", re: /\bfunction\s+calculateFees\b/ },
  { name: "deriveNetContribution redefinition", re: /\bfunction\s+deriveNetContribution\b/ },
  { name: "settlement cutoff redefinition", re: /\bfunction\s+getSettlementCutoff(Utc)?\b/ },
  { name: "computeWalletBalances redefinition", re: /\bfunction\s+computeWalletBalances\b/ },
  { name: "inline fee-rate math (Math.min(x*rate, 2000))", re: /Math\.min\([^,)]*\*\s*0\.0(15|05|1)\b[^,)]*,\s*2000\b/ },
  { name: "hardcoded completed-withdrawal Set", re: /new\s+Set\(\s*\[[^\]]*["'](completed|successful|approved)["']/ },
];

function isAllowed(file) {
  const f = resolve(file);
  return ALLOW.some((a) => f === a || f.startsWith(a + sep));
}

function stripInlineBlocks(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (line.includes(BEGIN)) { inside = true; out.push(""); continue; }
    if (line.includes(END)) { inside = false; out.push(""); continue; }
    out.push(inside ? "" : line);
  }
  return out;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (/\.(ts|js|mjs)$/.test(name)) yield p;
  }
}

const violations = [];
for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    if (isAllowed(file)) continue;
    const lines = stripInlineBlocks(readFileSync(file, "utf8"));
    lines.forEach((line, i) => {
      // Ignore comment-only lines and engine bindings (`= FPE.xxx`).
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      if (/=\s*FPE\./.test(line)) return;
      for (const rule of RULES) {
        if (rule.re.test(line)) {
          violations.push({ file: relative(codebase, file), line: i + 1, rule: rule.name, text: trimmed.slice(0, 100) });
        }
      }
    });
  }
}

if (violations.length) {
  console.error("✗ Financial-duplication guardrail FAILED — local financial math found outside the engine:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]\n      ${v.text}`);
  }
  console.error(`\n${violations.length} violation(s). Delegate to kolekto-shared-financial (import/vendor/inline) instead.`);
  process.exit(1);
}

console.log(`✓ Financial-duplication guardrail PASSED — scanned ${SCAN_ROOTS.length} roots; no local financial math outside the engine + SQL mirror.`);
