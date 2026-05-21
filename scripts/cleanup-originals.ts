// One-off cleanup: remove all stored original/ files on disk and null out
// the storagePathOriginal column for matching ImageVersion rows.
//
// New uploads never write originals anymore, but legacy data still has them
// on disk. Run this once to reclaim that space.
//
// Usage:
//   npx tsx scripts/cleanup-originals.ts          # dry-run (default)
//   npx tsx scripts/cleanup-originals.ts --apply  # actually delete

import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const STORAGE_DIR = process.env.STORAGE_DIR ?? "./data";
const ROOT = path.resolve(process.cwd(), STORAGE_DIR);

const prisma = new PrismaClient();

async function main() {
  console.log(apply ? "RUNNING WITH --apply" : "DRY RUN (use --apply to actually delete)");
  console.log("Storage root:", ROOT);

  // Find project directories on disk
  const projectsDir = path.join(ROOT, "projects");
  let projectIds: string[] = [];
  try {
    projectIds = await fs.readdir(projectsDir);
  } catch (err) {
    console.error("Could not read storage dir:", err);
    return;
  }

  let totalFiles = 0;
  let totalBytes = 0;

  for (const projectId of projectIds) {
    const originalDir = path.join(projectsDir, projectId, "original");
    let entries: string[] = [];
    try {
      entries = await fs.readdir(originalDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const filePath = path.join(originalDir, entry);
      try {
        const st = await fs.stat(filePath);
        if (!st.isFile()) continue;
        totalFiles += 1;
        totalBytes += st.size;
        if (apply) await fs.unlink(filePath);
      } catch (err) {
        console.warn(`  skip ${filePath}:`, err);
      }
    }
    if (apply) {
      try {
        await fs.rmdir(originalDir);
      } catch {
        // dir might not be empty if a file failed to delete
      }
    }
  }

  console.log(
    `${apply ? "Deleted" : "Would delete"} ${totalFiles} file${
      totalFiles === 1 ? "" : "s"
    } · ${(totalBytes / 1024 / 1024).toFixed(1)} MB`
  );

  // Null out DB column for any rows whose path is no longer on disk.
  if (apply) {
    const result = await prisma.imageVersion.updateMany({
      where: { storagePathOriginal: { not: null } },
      data: { storagePathOriginal: null },
    });
    console.log(`Cleared storagePathOriginal on ${result.count} ImageVersion rows`);
  } else {
    const count = await prisma.imageVersion.count({
      where: { storagePathOriginal: { not: null } },
    });
    console.log(`Would clear storagePathOriginal on ${count} ImageVersion rows`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
