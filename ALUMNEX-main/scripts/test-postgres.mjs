import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
const files = readdirSync("tests")
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => "tests/" + f);
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "--test-concurrency=1", ...files],
  { env: { ...process.env, ALUMNEX_TEST_POSTGRES: "1" }, stdio: "inherit" },
);
process.exit(result.status ?? 1);
