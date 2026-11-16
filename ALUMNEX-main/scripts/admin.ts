import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const { one, query, closeDatabase, transaction } = await import("../lib/db");
const { audit } = await import("../lib/security");
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run admin -- verified-administrator@example.com");
  process.exit(1);
}
const user = await one("SELECT id,name FROM users WHERE email=$1", [email]);
if (!user) {
  console.error(
    "Account not found. Create the intended administrator account through Sign Up first.",
  );
  process.exit(1);
}
await transaction(async () => {
  await query(
    "UPDATE users SET role='admin',verified=1,status='active' WHERE id=$1",
    [user.id],
  );
  await query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
  await audit(user.id, "admin_granted_by_operator", user.id);
});
console.log(
  "Administrator access granted to the existing account. Sign in again.",
);
await closeDatabase();
