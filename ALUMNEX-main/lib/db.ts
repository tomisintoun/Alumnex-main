import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { DatabaseSync } from "node:sqlite";

export type Row = Record<string, any>;
type Context = { client?: PoolClient; sqlite?: boolean; testPg?: any };
const context = new AsyncLocalStorage<Context>();
let pool: Pool | undefined;
let sqlite: DatabaseSync | undefined;
let ready: Promise<void> | undefined;
let testPg: any;
const isTestPg = () =>
  process.env.NODE_ENV === "test" && process.env.ALUMNEX_TEST_POSTGRES === "1";
let queue: Promise<unknown> = Promise.resolve();
async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const task = queue.then(fn, fn);
  queue = task.catch(() => {});
  return task;
}
function local() {
  if (process.env.NODE_ENV === "production")
    throw new Error("DATABASE_URL is required in production.");
  if (!sqlite) {
    const path = process.env.SQLITE_PATH || ".data/alumnex.sqlite";
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(/* turbopackIgnore: true */ path)), {
        recursive: true,
      });
    sqlite = new DatabaseSync(path);
    sqlite.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
  }
  return sqlite;
}
async function raw(sql: string, params: unknown[] = []): Promise<Row[]> {
  if (isTestPg()) {
    if (!testPg) {
      const { PGlite } = await import("@electric-sql/pglite");
      testPg = new PGlite();
      await testPg.waitReady;
    }
    const run = async () =>
      (await (context.getStore()?.testPg || testPg).query(sql, params)).rows;
    return context.getStore()?.testPg ? run() : exclusive(run);
  }
  if (process.env.DATABASE_URL) {
    pool ||= new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 8,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
    return (await (context.getStore()?.client || pool).query(sql, params)).rows;
  }
  const run = async () => {
    const ordered: any[] = [];
    const statement = local().prepare(
      sql.replace(/\$(\d+)/g, (_, n) => {
        ordered.push(params[Number(n) - 1]);
        return "?";
      }),
    );
    return statement.all(...ordered) as Row[];
  };
  return context.getStore()?.sqlite ? run() : exclusive(run);
}
export async function query(sql: string, params: unknown[] = []) {
  await initialize();
  return raw(sql, params);
}
export async function one(sql: string, params: unknown[] = []) {
  return (await query(sql, params))[0] || null;
}
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  await initialize();
  if (context.getStore()) return fn();
  if (isTestPg())
    return exclusive(() =>
      testPg.transaction((client: any) => context.run({ testPg: client }, fn)),
    );
  if (process.env.DATABASE_URL) {
    const client = await pool!.connect();
    try {
      await client.query("BEGIN");
      const result = await context.run({ client }, fn);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return exclusive(async () => {
    local().exec("BEGIN IMMEDIATE");
    try {
      const result = await context.run({ sqlite: true }, fn);
      local().exec("COMMIT");
      return result;
    } catch (error) {
      local().exec("ROLLBACK");
      throw error;
    }
  });
}
export function id() {
  return randomUUID();
}
export function json(row: Row | null): Row | null {
  return row ? { ...row, data: JSON.parse(row.data || "{}") } : null;
}

const schema = [
  `CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY, applied_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('student','alumni','employer','admin')), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)), profile TEXT NOT NULL DEFAULT '{}', created_at BIGINT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf TEXT NOT NULL, expires_at BIGINT NOT NULL, absolute_expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_id TEXT, event TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '{}', created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL, used_at BIGINT)`,
  `CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('opportunity','event','community','campaign','announcement')),
 owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','pending','published','closed','rejected')),
 data TEXT NOT NULL DEFAULT '{}', created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS saved (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE, PRIMARY KEY(user_id,resource_id))`,
  `CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), resource_id TEXT NOT NULL REFERENCES resources(id),
 status TEXT NOT NULL CHECK(status IN ('submitted','under_review','interview','accepted','rejected','withdrawn')), data TEXT NOT NULL, created_at BIGINT NOT NULL, UNIQUE(user_id,resource_id))`,
  `CREATE TABLE IF NOT EXISTS registrations (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),resource_id TEXT NOT NULL REFERENCES resources(id),data TEXT NOT NULL,created_at BIGINT NOT NULL,UNIQUE(user_id,resource_id))`,
  `CREATE TABLE IF NOT EXISTS memberships (user_id TEXT NOT NULL REFERENCES users(id),resource_id TEXT NOT NULL REFERENCES resources(id),created_at BIGINT NOT NULL,PRIMARY KEY(user_id,resource_id))`,
  `CREATE TABLE IF NOT EXISTS community_posts (id TEXT PRIMARY KEY,resource_id TEXT NOT NULL REFERENCES resources(id),user_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS post_reactions (user_id TEXT NOT NULL REFERENCES users(id),post_id TEXT NOT NULL REFERENCES community_posts(id),PRIMARY KEY(user_id,post_id))`,
  `CREATE TABLE IF NOT EXISTS connections (id TEXT PRIMARY KEY,sender_id TEXT NOT NULL REFERENCES users(id),receiver_id TEXT NOT NULL REFERENCES users(id),pair_key TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','blocked')),created_at BIGINT NOT NULL,CHECK(sender_id<>receiver_id))`,
  `CREATE TABLE IF NOT EXISTS mentorships (id TEXT PRIMARY KEY,student_id TEXT NOT NULL REFERENCES users(id),mentor_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL CHECK(status IN ('pending','active','declined','completed','cancelled')),data TEXT NOT NULL,created_at BIGINT NOT NULL,UNIQUE(student_id,mentor_id),CHECK(student_id<>mentor_id))`,
  `CREATE TABLE IF NOT EXISTS mentorship_items (id TEXT PRIMARY KEY,mentorship_id TEXT NOT NULL REFERENCES mentorships(id),kind TEXT NOT NULL CHECK(kind IN ('goal','session','resource','feedback')),
 owner_id TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY,sender_id TEXT NOT NULL REFERENCES users(id),receiver_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,read_at BIGINT,created_at BIGINT NOT NULL,CHECK(sender_id<>receiver_id))`,
  `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,body TEXT NOT NULL,href TEXT NOT NULL,read_at BIGINT,created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS donations (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),campaign_id TEXT NOT NULL REFERENCES resources(id),amount INTEGER NOT NULL CHECK(amount>=10000),
 currency TEXT NOT NULL DEFAULT 'NGN',reference TEXT NOT NULL UNIQUE,status TEXT NOT NULL CHECK(status IN ('pending','paid','failed')),provider_id TEXT UNIQUE,created_at BIGINT NOT NULL,paid_at BIGINT)`,
  `CREATE TABLE IF NOT EXISTS support_tickets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',response TEXT,created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,content TEXT NOT NULL,created_at BIGINT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS resources_kind_status ON resources(kind,status)`,
  `CREATE INDEX IF NOT EXISTS messages_recipient ON messages(receiver_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS applications_resource ON applications(resource_id)`,
  `CREATE INDEX IF NOT EXISTS community_posts_resource ON community_posts(resource_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS audit_time ON audit_logs(created_at)`,
];
export async function initialize() {
  if (!ready)
    ready = (async () => {
      for (const statement of schema) await raw(statement);
      if (process.env.DATABASE_URL || isTestPg()) {
        await raw(
          `CREATE OR REPLACE FUNCTION public.alumnex_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit log is append only'; END; $$`,
        );
        await raw(
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='alumnex_audit_immutable' AND tgrelid='audit_logs'::regclass) THEN CREATE TRIGGER alumnex_audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.alumnex_append_only(); END IF; END $$`,
        );
        await raw(
          `ALTER FUNCTION public.alumnex_append_only() SET search_path = pg_catalog`,
        );
        // Direct browser Data API access is denied; the server enforces authorization with its DB connection.
        for (const table of [
          "users",
          "sessions",
          "rate_limits",
          "audit_logs",
          "password_resets",
          "resources",
          "saved",
          "applications",
          "registrations",
          "memberships",
          "community_posts",
          "post_reactions",
          "connections",
          "mentorships",
          "mentorship_items",
          "messages",
          "notifications",
          "donations",
          "support_tickets",
          "files",
          "schema_versions",
        ]) {
          await raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        }
      } else {
        local()
          .exec(`CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT,'Audit log is append only'); END;
        CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT,'Audit log is append only'); END;`);
      }
      await raw(
        `INSERT INTO schema_versions(version,applied_at) VALUES(1,$1) ON CONFLICT(version) DO NOTHING`,
        [Date.now()],
      );
    })().catch((error) => {
      ready = undefined;
      throw error;
    });
  await ready;
}
export async function closeDatabase() {
  await pool?.end();
  await testPg?.close();
  sqlite?.close();
  pool = undefined;
  testPg = undefined;
  sqlite = undefined;
  ready = undefined;
}
