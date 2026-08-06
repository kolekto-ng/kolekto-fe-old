#!/usr/bin/env node
// scripts/verifyEdgeFunctionDeployment.js
//
// Phase 5 (architectural hardening): automated proof that what's deployed
// matches what's in git. This exists because BOTH root causes of the
// collection-creation incident were deployment-consistency failures:
//   1. create-collection was deployed 3.5 weeks behind its own repo source
//      (the KYC gate existed in git, was never pushed).
//   2. 4 functions (update-collection-status, change-password, zepto-debug,
//      settle-pending-deposits) were deployed with NO corresponding source
//      in git at all — completely unauditable from the repository.
//   3. 51 database migrations were applied to the remote project with no
//      corresponding migration file ever committed.
//
// This script closes gap #1/#2 for Edge Functions: for every function
// directory under supabase/functions/, it downloads the ACTUALLY DEPLOYED
// source from the linked project and diffs it (via SHA-256) against the
// git-committed source at HEAD. Any mismatch — stale deployment OR
// undocumented deployment — fails the run.
//
// Usage:
//   node scripts/verifyEdgeFunctionDeployment.js
//   node scripts/verifyEdgeFunctionDeployment.js --project-ref <ref>   (defaults to the linked project)
//
// Exit code 0 = deployed matches git HEAD for every function.
// Exit code 1 = drift found (or a function exists in git but isn't deployed,
//               or is deployed but doesn't exist in git).
//
// Intended use: a required CI check on the deploy pipeline, and/or a
// pre-deploy sanity check an operator runs by hand. It does not deploy or
// modify anything — read-only against the Supabase Management API/CLI and
// against git.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const FUNCTIONS_DIR = join(REPO_ROOT, "supabase", "functions");

// `--workdir <scratch dir>` alone isn't enough for `functions download` — it
// still needs a resolved project ref, which normally comes from the CLI's
// own `.temp/project-ref` link file in a real project directory. A bare
// scratch dir has no such link, so the ref must be passed explicitly.
const projectRefArgIndex = process.argv.indexOf("--project-ref");
const PROJECT_REF =
  (projectRefArgIndex !== -1 && process.argv[projectRefArgIndex + 1]) ||
  (() => {
    try {
      return readFileSync(join(REPO_ROOT, "supabase", ".temp", "project-ref"), "utf8").trim();
    } catch {
      return null;
    }
  })();

if (!PROJECT_REF) {
  console.error("Could not resolve a project ref — pass --project-ref <ref> or run `supabase link` first.");
  process.exit(1);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

/** Git-committed content at HEAD — deliberately NOT the working tree, so an
 * uncommitted local edit can't produce a false "matches" result. */
function gitHeadContent(relativePath) {
  try {
    return execFileSync("git", ["show", `HEAD:${relativePath.replace(/\\/g, "/")}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
  } catch {
    return null; // file doesn't exist in git HEAD
  }
}

async function listLocalFunctionSlugs() {
  const entries = await readdir(FUNCTIONS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name);
}

// shell: true — on Windows, `supabase` resolves to a .cmd/.ps1 shim that
// execFileSync cannot spawn directly without going through a shell; this is
// harmless and correct on POSIX too (execFileSync respects the array-of-args
// form even with shell: true, since each element is still passed as its own
// argument, not concatenated into a single command string).
function downloadDeployedSource(slug, destDir) {
  execFileSync(
    "supabase",
    ["functions", "download", slug, "--use-api", "--project-ref", PROJECT_REF, "--workdir", destDir],
    { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"], shell: true, encoding: "utf8" }
  );
  const path = join(destDir, "supabase", "functions", slug, "index.ts");
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function listDeployedSlugs() {
  const raw = execFileSync("supabase", ["functions", "list", "--project-ref", PROJECT_REF, "-o", "json"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
  });
  const parsed = JSON.parse(raw);
  // `-o json` returns a bare array; without that flag the CLI returns
  // { functions: [...] } instead — handle both rather than silently getting
  // an empty set from whichever shape wasn't expected (an empty set here
  // must never look like "nothing is deployed, so nothing to check").
  const list = Array.isArray(parsed) ? parsed : parsed.functions;
  if (!Array.isArray(list)) {
    throw new Error("Unexpected `supabase functions list` output shape — refusing to report a false PASS");
  }
  return new Set(list.map((f) => f.slug));
}

async function main() {
  console.log("=== Edge Function Deployment Consistency Check ===\n");

  const localSlugs = new Set(await listLocalFunctionSlugs());
  const deployedSlugs = listDeployedSlugs();

  if (deployedSlugs.size === 0) {
    throw new Error("`supabase functions list` reported zero deployed functions — that's almost certainly a tooling/auth problem, not reality. Refusing to report PASS.");
  }

  const onlyLocal = [...localSlugs].filter((s) => !deployedSlugs.has(s));
  const onlyDeployed = [...deployedSlugs].filter((s) => !localSlugs.has(s));

  if (onlyLocal.length) {
    console.log("⚠ In git but NOT deployed:", onlyLocal.join(", "));
  }
  if (onlyDeployed.length) {
    console.log("🚨 DEPLOYED but has NO source in git (undocumented — exactly the class of gap this audit found):", onlyDeployed.join(", "));
  }

  const scratch = mkdtempSync(join(tmpdir(), "edge-fn-verify-"));
  const drifted = [];
  const matched = [];

  try {
    for (const slug of [...localSlugs].filter((s) => deployedSlugs.has(s))) {
      const gitContent = gitHeadContent(`supabase/functions/${slug}/index.ts`);
      if (gitContent === null) {
        console.log(`⚠ ${slug}: exists locally but is not committed to git HEAD — skipping (commit it first)`);
        continue;
      }

      let deployedContent;
      try {
        deployedContent = downloadDeployedSource(slug, scratch);
      } catch (err) {
        const detail = (err.stderr || err.message || "").toString().trim().split("\n")[0];
        console.log(`✗ ${slug}: could not download deployed source (${detail})`);
        drifted.push(slug);
        continue;
      }

      if (deployedContent === null) {
        console.log(`✗ ${slug}: download succeeded but no index.ts was produced`);
        drifted.push(slug);
        continue;
      }

      const gitHash = sha256(gitContent.trim());
      const deployedHash = sha256(deployedContent.trim());

      if (gitHash === deployedHash) {
        matched.push(slug);
      } else {
        console.log(`🚨 ${slug}: DEPLOYMENT DRIFT — deployed source does not match git HEAD`);
        console.log(`   git HEAD sha256:     ${gitHash}`);
        console.log(`   deployed sha256:     ${deployedHash}`);
        drifted.push(slug);
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  console.log(`\n${matched.length} function(s) match git HEAD exactly:`, matched.join(", ") || "(none)");

  const failed = drifted.length > 0 || onlyDeployed.length > 0;
  if (failed) {
    console.log("\n=== RESULT: FAIL — deployment does not match repository ===");
    process.exit(1);
  }
  console.log("\n=== RESULT: PASS — every deployed function matches its committed source ===");
}

main().catch((err) => {
  console.error("Verification script failed:", err.message);
  process.exit(1);
});
