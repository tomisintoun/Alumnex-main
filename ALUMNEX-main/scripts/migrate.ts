import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const { initialize, closeDatabase } = await import("../lib/db");
await initialize();
if (process.env.SEED_DEMO === "true") {
  const { seedDemo } = await import("../lib/seed");
  await seedDemo();
}
console.log("ALUMNEX schema is up to date.");
await closeDatabase();
