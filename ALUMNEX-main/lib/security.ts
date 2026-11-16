import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hash, compare } from "bcryptjs";
import { query, one, transaction, id, type Row } from "./db";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function cookies(request: Request) {
  return Object.fromEntries(
    (request.headers.get("cookie") || "")
      .split(";")
      .map((c) => c.trim().split(/=(.*)/s).slice(0, 2))
      .filter((c) => c.length === 2),
  );
}
export const cookieName = "alumnex_session";
export function cookie(value: string, seconds: number, name = cookieName) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function origin(request: Request) {
  const expected = process.env.APP_ORIGIN || "http://localhost:3000";
  assert(
    process.env.NODE_ENV !== "production" || expected.startsWith("https://"),
    503,
    "HTTPS APP_ORIGIN must be configured.",
  );
  assert(
    request.headers.get("origin") === new URL(expected).origin,
    403,
    "Request origin was not accepted.",
  );
  assert(
    request.headers.get("sec-fetch-site") !== "cross-site",
    403,
    "Cross-site request was not accepted.",
  );
}
export async function csrf(request: Request, session?: Row | null) {
  origin(request);
  const supplied = request.headers.get("x-csrf-token") || "";
  const expected = session?.csrf || cookies(request).alumnex_csrf || "";
  assert(
    supplied.length >= 32 && expected.length >= 32 && equal(supplied, expected),
    403,
    "Your session changed. Refresh the page and try again.",
  );
}
export async function audit(
  actor: string | null,
  event: string,
  target = "",
  details: Record<string, unknown> = {},
) {
  await query(
    "INSERT INTO audit_logs(id,actor_id,event,target,details,created_at) VALUES($1,$2,$3,$4,$5,$6)",
    [id(), actor, event, target, JSON.stringify(details), Date.now()],
  );
}
export async function notify(
  userId: string,
  title: string,
  body: string,
  href = "/app",
) {
  await query(
    "INSERT INTO notifications(id,user_id,title,body,href,created_at) VALUES($1,$2,$3,$4,$5,$6)",
    [id(), userId, title, body, href, Date.now()],
  );
}
export async function limit(
  bucket: string,
  maximum = 10,
  window = 15 * 60_000,
) {
  const now = Date.now();
  const row = await one(
    `INSERT INTO rate_limits(bucket,attempts,resets_at) VALUES($1,1,$2)
    ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN rate_limits.resets_at<$3 THEN 1 ELSE rate_limits.attempts+1 END,
    resets_at=CASE WHEN rate_limits.resets_at<$3 THEN $2 ELSE rate_limits.resets_at END RETURNING attempts,resets_at`,
    [digest(bucket), now + window, now],
  );
  assert(
    Number(row.attempts) <= maximum,
    429,
    "Too many attempts. Please try again later.",
  );
}
export function publicUser(user: Row, own = false) {
  const p = JSON.parse(user.profile || "{}");
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    verified: !!user.verified,
    ...(own ? { email: user.email, status: user.status } : {}),
    profile: {
      title: p.title || "",
      company: p.company || "",
      faculty: p.faculty || "",
      department: p.department || "",
      graduation: p.graduation || "",
      level: p.level || "",
      location: p.location || "",
      industry: p.industry || "",
      bio: p.bio || "",
      skills: p.skills || [],
      interests: p.interests || [],
      mentorAvailable: !!p.mentorAvailable,
      avatar: p.avatar ?? null,
      ...(own
        ? {
            visibility: p.visibility || "network",
            messages: p.messages || "connections",
            online: p.online ?? true,
          }
        : {}),
    },
  };
}
export async function getSession(request: Request, refresh = true) {
  const value = cookies(request)[cookieName];
  if (!value || value.length !== 64) return null;
  const row = await one(
    `SELECT s.*,u.id,u.email,u.password_hash,u.name,u.role,u.status,u.verified,u.profile,u.created_at AS user_created_at
    FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=$1`,
    [digest(value)],
  );
  if (
    !row ||
    row.status !== "active" ||
    Number(row.expires_at) < Date.now() ||
    Number(row.absolute_expires_at) < Date.now()
  )
    return null;
  if (refresh)
    await query("UPDATE sessions SET expires_at=$1 WHERE token_hash=$2", [
      Math.min(Date.now() + 30 * 60_000, Number(row.absolute_expires_at)),
      digest(value),
    ]);
  return row;
}
export async function requireUser(request: Request) {
  const u = await getSession(request);
  assert(u, 401, "Please sign in to continue.");
  return u;
}
export function role(user: Row, ...roles: string[]) {
  assert(
    roles.includes(user.role),
    403,
    "You don’t have access to this action.",
  );
}
export async function sessionFor(user: Row, remember = false) {
  const value = token();
  const csrf = token();
  const now = Date.now();
  const seconds = remember ? 7 * 86400 : 86400;
  await query(
    "INSERT INTO sessions(token_hash,user_id,csrf,expires_at,absolute_expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6)",
    [
      digest(value),
      user.id,
      csrf,
      now + 30 * 60_000,
      now + seconds * 1000,
      now,
    ],
  );
  return { cookie: cookie(value, seconds), csrf };
}
export async function authenticate(email: string, password: string) {
  await limit("login:" + email, 5);
  const user = await one("SELECT * FROM users WHERE email=$1", [email]);
  // This hash has the same cost as real accounts; nonexistent accounts still perform a password check.
  const fallback =
    "$2b$12$C6UzMDM.H6dfI/f/IKcEe.0oZ7M5YFQvS6qvQ9hMXXF5cvVhJmM8u";
  const valid = await compare(password, user?.password_hash || fallback);
  if (!valid || !user || user.status !== "active") {
    await audit(user?.id || null, "login_failed");
    throw new HttpError(401, "Email or password is incorrect.");
  }
  await query("DELETE FROM rate_limits WHERE bucket=$1", [
    digest("login:" + email),
  ]);
  await audit(user.id, "login");
  return user;
}
export async function passwordHash(password: string) {
  return hash(password, 12);
}
export async function issuePasswordReset(userId: string) {
  const value = token();
  await query(
    "UPDATE password_resets SET used_at=$1 WHERE user_id=$2 AND used_at IS NULL",
    [Date.now(), userId],
  );
  await query(
    "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
    [digest(value), userId, Date.now() + 30 * 60_000],
  );
  return value;
}
export async function consumePasswordReset(value: string, password: string) {
  const password_hash = await passwordHash(password);
  await transaction(async () => {
    const row = await one(
      "UPDATE password_resets SET used_at=$1 WHERE token_hash=$2 AND used_at IS NULL AND expires_at>$1 RETURNING user_id",
      [Date.now(), digest(value)],
    );
    assert(
      row,
      400,
      "This reset link is invalid or expired. Request a new one.",
    );
    await query("UPDATE users SET password_hash=$1 WHERE id=$2", [
      password_hash,
      row.user_id,
    ]);
    await query("DELETE FROM sessions WHERE user_id=$1", [row.user_id]);
    await audit(row.user_id, "password_reset");
  });
}
export async function canMessage(actor: Row, targetId: string) {
  if (actor.id === targetId) return false;
  const target = await one("SELECT * FROM users WHERE id=$1 AND status=$2", [
    targetId,
    "active",
  ]);
  if (!target) return false;
  const connection = await one("SELECT * FROM connections WHERE pair_key=$1", [
    [actor.id, targetId].sort().join(":"),
  ]);
  if (connection?.status === "blocked") return false;
  const mentorship = await one(
    "SELECT id FROM mentorships WHERE ((student_id=$1 AND mentor_id=$2) OR (student_id=$2 AND mentor_id=$1)) AND status=$3",
    [actor.id, targetId, "active"],
  );
  const setting = JSON.parse(target.profile || "{}").messages || "connections";
  return (
    setting !== "nobody" &&
    (connection?.status === "accepted" ||
      !!mentorship ||
      (setting === "network" && actor.verified))
  );
}
