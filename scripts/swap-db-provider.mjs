#!/usr/bin/env node
// Toggle prisma datasource provider between "sqlite" (dev) and "postgresql"
// (prod). Prisma doesn't accept env-driven providers, so we rewrite the line
// in schema.prisma. Idempotent — running with the same target twice is a noop.
//
// Usage:
//   node scripts/swap-db-provider.mjs sqlite
//   node scripts/swap-db-provider.mjs postgresql

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "..", "prisma", "schema.prisma");

const target = process.argv[2];
if (target !== "sqlite" && target !== "postgresql") {
  console.error("Usage: swap-db-provider.mjs <sqlite|postgresql>");
  process.exit(1);
}

const src = readFileSync(schemaPath, "utf8");
const re = /provider\s*=\s*"(sqlite|postgresql)"/;
const m = src.match(re);
if (!m) {
  console.error("Could not find datasource provider in schema.prisma");
  process.exit(1);
}
if (m[1] === target) {
  console.log(`Provider already set to "${target}". No change.`);
  process.exit(0);
}
const next = src.replace(re, `provider = "${target}"`);
writeFileSync(schemaPath, next, "utf8");
console.log(`Swapped provider: "${m[1]}" → "${target}"`);
