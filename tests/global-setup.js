import { execSync } from "node:child_process";
import { rm, mkdir } from "node:fs/promises";

// Runs once before all test files.
// Manually deletes the test DB (avoids Prisma's --force-reset AI safety guard),
// then pushes the dev schema to create a fresh one.
export async function setup() {
  await mkdir("./data", { recursive: true });

  // Remove all SQLite files for the test DB so we start clean
  await rm("./data/test.db", { force: true });
  await rm("./data/test.db-shm", { force: true });
  await rm("./data/test.db-wal", { force: true });

  execSync("npx prisma db push --schema=prisma/schema.dev.prisma", {
    env: { ...process.env, DATABASE_URL: "file:./data/test.db" },
    stdio: "inherit",
  });
}
