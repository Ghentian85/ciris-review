#!/usr/bin/env node
// Push the current Prisma schema to the production Postgres database.
//
// The trick: we briefly swap prisma/schema.prisma from sqlite → postgresql,
// run `prisma db push`, then swap back to sqlite — all in one shot. Always
// swaps back even if the push fails, so your local dev env keeps working.
//
// Usage:
//   DATABASE_URL='postgres://...' npm run db:push-prod
//
// You can grab the prod DATABASE_URL from Vercel:
//   Settings → Environment Variables → Production → copy DATABASE_URL.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const swapScript = resolve(here, "swap-db-provider.mjs");

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} → exit ${res.status}`);
  }
}

if (!process.env.DATABASE_URL) {
  console.error("");
  console.error("✗ DATABASE_URL is not set.");
  console.error("");
  console.error("  Get it from Vercel → Settings → Environment Variables → Production.");
  console.error("  Then run:  DATABASE_URL='postgres://...' npm run db:push-prod");
  console.error("");
  process.exit(1);
}

if (!process.env.DATABASE_URL.startsWith("postgres")) {
  console.error("");
  console.error(`✗ DATABASE_URL doesn't look like a Postgres URL: ${process.env.DATABASE_URL.slice(0, 30)}…`);
  console.error("  Refusing to run — did you paste the right URL?");
  console.error("");
  process.exit(1);
}

console.log("→ Swapping schema to postgresql…");
run("node", [swapScript, "postgresql"]);

try {
  console.log("→ Pushing schema to production Postgres…");
  run("npx", ["prisma", "db", "push"]);
  console.log("✓ Schema pushed to production.");
} finally {
  console.log("→ Swapping schema back to sqlite for local dev…");
  // Swap back unconditionally — even if the push failed, you want your
  // local schema in the sqlite state. Failures here are warnings, not fatal.
  const r = spawnSync("node", [swapScript, "sqlite"], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("⚠ Swap-back failed. Run `npm run db:use-sqlite` manually.");
  }
}
