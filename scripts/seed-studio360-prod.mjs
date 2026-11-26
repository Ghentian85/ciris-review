#!/usr/bin/env node
// Prod wrapper for scripts/seed-studio360.ts.
//
// The Prisma client needs to be generated against the postgres provider
// before we can run a prod seed, and we must swap the schema back to
// sqlite afterwards so local dev keeps working. Same orchestration as
// scripts/db-push-prod.mjs; refuses to run without DATABASE_URL.
//
// Usage:
//   DATABASE_URL='postgres://…' npm run seed:studio360

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const swapScript = resolve(here, "swap-db-provider.mjs");
const seedScript = resolve(here, "seed-studio360.ts");

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} → exit ${res.status}`);
  }
}

if (!process.env.DATABASE_URL) {
  console.error("");
  console.error("✗ DATABASE_URL is not set.");
  console.error("");
  console.error("  Get it from Vercel → Settings → Environment Variables → Production.");
  console.error("  Then run:  DATABASE_URL='postgres://…' npm run seed:studio360");
  console.error("");
  process.exit(1);
}
if (!process.env.DATABASE_URL.startsWith("postgres")) {
  console.error("");
  console.error("✗ DATABASE_URL doesn't look like a Postgres URL. Refusing to run.");
  console.error("");
  process.exit(1);
}

console.log("→ Swapping schema to postgresql…");
run("node", [swapScript, "postgresql"]);
run("npx", ["prisma", "generate"]);

try {
  console.log("→ Running Studio 360 seed…");
  run("npx", ["tsx", seedScript]);
} finally {
  console.log("→ Swapping schema back to sqlite for local dev…");
  const r = spawnSync("node", [swapScript, "sqlite"], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("⚠ Swap-back failed. Run `npm run db:use-sqlite && npx prisma generate` manually.");
  } else {
    spawnSync("npx", ["prisma", "generate"], { stdio: "inherit" });
  }
}
