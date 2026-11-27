#!/usr/bin/env node
// One-shot: push a CORS policy to the R2 bucket so browsers on
// review.ciris.studio and studio360.ciris.studio can PUT directly to
// presigned upload URLs.
//
// Reads S3_* credentials from ~/CIRIS/ciris-review/.env.vercel (what
// `vercel env pull` produces), so you never have to paste keys around.
//
// Usage (from the project root):
//   node scripts/set-r2-cors.mjs
//
// Safe to run multiple times — PutBucketCors replaces the current policy.

import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env.vercel");

if (!existsSync(envPath)) {
  console.error("");
  console.error("✗ .env.vercel not found at", envPath);
  console.error("  Run first:  npx vercel env pull .env.vercel --environment=production");
  console.error("");
  process.exit(1);
}

const env = {};
for (const raw of readFileSync(envPath, "utf8").split("\n")) {
  const m = raw.match(/^([A-Z0-9_]+)="?([^"\n]*)"?$/);
  if (m) env[m[1]] = m[2];
}

const bucket = env.S3_BUCKET;
const endpoint = env.S3_ENDPOINT;
const accessKeyId = env.S3_ACCESS_KEY;
const secretAccessKey = env.S3_SECRET_KEY;

for (const [key, val] of Object.entries({
  S3_BUCKET: bucket,
  S3_ENDPOINT: endpoint,
  S3_ACCESS_KEY: accessKeyId,
  S3_SECRET_KEY: secretAccessKey,
})) {
  if (!val) {
    console.error(`✗ ${key} missing from .env.vercel`);
    process.exit(1);
  }
}

const client = new S3Client({
  region: env.S3_REGION || "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

const CORSRules = [
  {
    AllowedOrigins: [
      "https://review.ciris.studio",
      "https://studio360.ciris.studio",
    ],
    AllowedMethods: ["PUT", "GET", "HEAD"],
    AllowedHeaders: ["*"],
    ExposeHeaders: ["ETag"],
    MaxAgeSeconds: 3600,
  },
];

console.log(`→ Bucket   : ${bucket}`);
console.log(`→ Endpoint : ${endpoint}`);
console.log(`→ Origins  : ${CORSRules[0].AllowedOrigins.join(", ")}`);
console.log("");

try {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules },
    })
  );
  console.log("✓ CORS policy applied.");
} catch (err) {
  console.error("✗ PutBucketCors failed:", err.message || err);
  process.exit(1);
}

try {
  const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log("");
  console.log("Current policy on the bucket:");
  console.log(JSON.stringify(current.CORSRules, null, 2));
} catch {
  // not fatal — PUT already succeeded
}
