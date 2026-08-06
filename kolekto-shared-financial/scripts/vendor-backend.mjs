/**
 * vendor-backend.mjs — sync the built engine into the Node backend.
 *
 * The backend (kolekto-be-old) is a plain-JS ESM app with no build step and it
 * deploys independently of this repo, so it cannot import this TypeScript
 * package at runtime. Instead we VENDOR the compiled ESM output into the backend
 * as a build artifact. The canonical source stays here (TypeScript); the backend
 * gets a generated, committed copy under utils/fpe/. Equivalence is guaranteed
 * by the golden-vector + differential-parity suites.
 *
 * Usage:
 *   npm run build && npm run vendor:backend
 *   # optional custom target:
 *   node scripts/vendor-backend.mjs ../../kolekto-be-old/utils/fpe
 *
 * Idempotent: wipes and rewrites the target directory from ./dist.
 */

import { cp, mkdir, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const distDir = join(pkgRoot, "dist");

const target = resolve(
  pkgRoot,
  process.argv[2] ?? "../../kolekto-be-old/utils/fpe"
);

if (!existsSync(distDir)) {
  console.error(`[vendor] dist/ not found at ${distDir}. Run \`npm run build\` first.`);
  process.exit(1);
}

// Clean + copy.
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(distDir, target, { recursive: true });

// Prepend a "generated — do not edit" banner to every emitted .js so nobody
// hand-edits the vendored copy instead of the canonical TypeScript source.
const banner =
  "// AUTO-GENERATED from kolekto-shared-financial — DO NOT EDIT BY HAND.\n" +
  "// Regenerate: (in kolekto-fe-old/kolekto-shared-financial) npm run build && npm run vendor:backend\n";

for (const name of await readdir(target)) {
  if (name.endsWith(".js")) {
    const p = join(target, name);
    const body = await readFile(p, "utf8");
    if (!body.startsWith("// AUTO-GENERATED")) {
      await writeFile(p, banner + body);
    }
  }
}

// Drop a README so the directory explains itself in the backend repo.
await writeFile(
  join(target, "README.md"),
  `# utils/fpe — vendored Financial Projection Engine

**Do not edit these files.** They are compiled output of the canonical package
\`kolekto-fe-old/kolekto-shared-financial\` (TypeScript). This backend consumes
the engine through \`utils/financial.js\`, which is a thin adapter over
\`utils/fpe/index.js\`.

To update after an engine change:

\`\`\`
cd ../kolekto-fe-old/kolekto-shared-financial
npm run build && npm run vendor:backend
\`\`\`

Equivalence to the source is guaranteed by the golden-vector conformance suite
and the differential parity tests in the package.
`
);

console.log(`[vendor] engine vendored → ${target}`);
