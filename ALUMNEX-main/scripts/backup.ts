import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error(
    "PostgreSQL DATABASE_URL is required. For local SQLite, stop the app and back up the .data directory.",
  );
  process.exit(1);
}
mkdirSync("backups", { recursive: true, mode: 0o700 });
const result = spawnSync(
  "pg_dump",
  [
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--file=backups/alumnex-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".dump",
  ],
  {
    env: { ...process.env, PGDATABASE: process.env.DATABASE_URL },
    stdio: ["ignore", "inherit", "inherit"],
  },
);
if (result.error) console.error("pg_dump must be installed and reachable.");
process.exit(result.status ?? 1);
