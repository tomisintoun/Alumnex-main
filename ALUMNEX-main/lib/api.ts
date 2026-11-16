import { z } from "zod";
import { query, one, transaction, id, json, type Row } from "./db";
import {
  HttpError,
  assert,
  cookies,
  cookie,
  cookieName,
  token,
  digest,
  csrf,
  getSession,
  requireUser,
  role,
  publicUser,
  authenticate,
  passwordHash,
  sessionFor,
  limit,
  audit,
  notify,
  issuePasswordReset,
  consumePasswordReset,
  canMessage,
} from "./security";
import {
  signupSchema,
  profileSchema,
  resourceSchema,
  applicationSchema,
  mentorshipSchema,
  itemSchema,
  password,
  email,
  text,
} from "./validation";
import { provider, verifyPayment, paymentSignature } from "./payments";

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
function response(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return Response.json(data, { status, headers: { ...headers, ...extra } });
}
async function readBody(request: Request, maximum: number) {
  assert(
    Number(request.headers.get("content-length") || 0) <= maximum,
    413,
    "This request is too large.",
  );
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new HttpError(413, "This request is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function body(request: Request, maximum = 65_536) {
  const raw = await readBody(request, maximum);
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Send a valid JSON request.");
  }
}
async function targetResource(resourceId: string, user: Row) {
  const r = json(
    await one("SELECT * FROM resources WHERE id=$1", [resourceId]),
  );
  assert(
    r &&
      (r.status === "published" ||
        r.owner_id === user.id ||
        user.role === "admin"),
    404,
    "This item was not found.",
  );
  return r;
}
async function participant(mentorshipId: string, user: Row) {
  const m = json(
    await one("SELECT * FROM mentorships WHERE id=$1", [mentorshipId]),
  );
  assert(
    m &&
      (m.student_id === user.id ||
        m.mentor_id === user.id ||
        user.role === "admin"),
    404,
    "Mentorship not found.",
  );
  return m;
}
function deadline(data: Row) {
  if (data.deadline)
    assert(
      Number.isFinite(Date.parse(data.deadline)) &&
        Date.parse(data.deadline) > Date.now(),
      409,
      "This deadline has passed.",
    );
}
function publisher(user: Row, kind: string) {
  assert(
    user.verified || user.role === "admin",
    403,
    "An administrator must verify your account before publishing.",
  );
  if (["campaign", "announcement"].includes(kind)) role(user, "admin");
  else if (kind === "opportunity") role(user, "alumni", "employer", "admin");
  else role(user, "alumni", "admin");
}
function resourceDates(kind: string, data: Row) {
  for (const field of ["deadline", "startsAt", "endsAt"])
    if (data[field])
      assert(
        Number.isFinite(Date.parse(data[field])),
        400,
        "Choose valid dates.",
      );
  if (kind === "event") {
    assert(data.startsAt, 400, "Choose an event start date.");
    assert(
      !data.endsAt || Date.parse(data.endsAt) > Date.parse(data.startsAt),
      400,
      "End date must be after start date.",
    );
  }
  if (kind === "campaign") assert(data.goal, 400, "Enter a campaign goal.");
}
async function directoryProfile(targetId: string, user: Row) {
  const u = await one("SELECT * FROM users WHERE id=$1 AND status=$2", [
    targetId,
    "active",
  ]);
  assert(u, 404, "Profile not found.");
  const p = JSON.parse(u.profile || "{}");
  if (u.id !== user.id && user.role !== "admin") {
    assert(u.verified && p.visibility !== "private", 404, "Profile not found.");
    if (p.visibility === "connections") {
      const c = await one(
        "SELECT id FROM connections WHERE pair_key=$1 AND status=$2",
        [[user.id, u.id].sort().join(":"), "accepted"],
      );
      assert(c, 404, "Profile not found.");
    }
  }
  return u;
}
const dataRows = (rows: Row[]) => rows.map((r) => json(r));
const pageLimit = 60;
function paging(url: URL) {
  return {
    limit: Math.floor(
      Math.min(
        pageLimit,
        Math.max(1, Number(url.searchParams.get("limit")) || 30),
      ),
    ),
    offset: Math.floor(
      Math.min(10000, Math.max(0, Number(url.searchParams.get("offset")) || 0)),
    ),
  };
}

export async function handle(
  request: Request,
  path: string[],
): Promise<Response> {
  const key = path.join("/"),
    method = request.method,
    url = new URL(request.url);
  let actor: Row | null = null;
  try {
    if (key === "health" && method === "GET") {
      await one("SELECT version FROM schema_versions WHERE version=1");
      return response({
        status: "ok",
        service: "ALUMNEX",
        database: process.env.DATABASE_URL
          ? "PostgreSQL"
          : "development SQLite",
      });
    }
    if (key === "payments/webhook" && method === "POST") {
      const raw = await readBody(request, 262144);
      assert(
        paymentSignature(
          raw,
          request.headers.get("x-paystack-signature") || "",
        ),
        401,
        "Invalid signature.",
      );
      const event = JSON.parse(raw);
      if (
        event.event === "charge.success" &&
        typeof event.data?.reference === "string"
      )
        await verifyPayment(event.data.reference);
      return response({ received: true });
    }
    if (key === "session" && method === "GET") {
      const s = await getSession(request);
      if (s)
        return response({
          user: publicUser(s, true),
          csrf: s.csrf,
          demo: process.env.SEED_DEMO === "true",
        });
      const anonymous = token();
      return response(
        { user: null, csrf: anonymous, demo: process.env.SEED_DEMO === "true" },
        200,
        { "Set-Cookie": cookie(anonymous, 3600, "alumnex_csrf") },
      );
    }
    actor = await getSession(request);
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      await csrf(request, actor);
      await limit("mutation:" + (actor?.id || "shared-anonymous"), 100, 60_000);
    }
    if (key === "auth/signup" && method === "POST") {
      const input = signupSchema.parse(await body(request));
      await limit("signup:" + "shared", 10, 3600_000);
      const existing = await one("SELECT id FROM users WHERE email=$1", [
        input.email,
      ]);
      assert(
        !existing,
        409,
        "This account could not be created. Try signing in or resetting your password.",
      );
      const userId = id(),
        hash = await passwordHash(input.password);
      await transaction(async () => {
        await query(
          "INSERT INTO users(id,email,password_hash,name,role,profile,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            userId,
            input.email,
            hash,
            input.name,
            input.role,
            JSON.stringify({
              visibility: "network",
              messages: "connections",
              online: true,
            }),
            Date.now(),
          ],
        );
        await audit(userId, "signup");
        await notify(
          userId,
          "Welcome to ALUMNEX",
          "Complete your profile to help the ABUAD network discover you.",
          "/app/settings",
        );
      });
      const user = await one("SELECT * FROM users WHERE id=$1", [userId]);
      const session = await sessionFor(user!);
      return response(
        { user: publicUser(user!, true), csrf: session.csrf },
        201,
        { "Set-Cookie": session.cookie },
      );
    }
    if (key === "auth/login" && method === "POST") {
      const input = z
        .object({
          email,
          password: z.string().max(200),
          remember: z.boolean().optional(),
        })
        .parse(await body(request));
      await limit("login-ip:" + "shared", 40);
      const user = await authenticate(input.email, input.password);
      const previous = cookies(request)[cookieName];
      if (previous)
        await query("DELETE FROM sessions WHERE token_hash=$1", [
          digest(previous),
        ]);
      const session = await sessionFor(user, input.remember);
      return response(
        { user: publicUser(user, true), csrf: session.csrf },
        200,
        { "Set-Cookie": session.cookie },
      );
    }
    if (key === "auth/forgot" && method === "POST") {
      const input = z.object({ email }).parse(await body(request));
      await limit("reset-ip:" + "shared", 8, 3600_000);
      await limit("reset-account:" + input.email, 3, 3600_000);
      assert(
        process.env.BREVO_API_KEY && process.env.EMAIL_FROM,
        503,
        "Password recovery email is awaiting configuration. Contact the ABUAD administrator.",
      );
      const u = await one("SELECT id FROM users WHERE email=$1", [input.email]);
      if (u) {
        const t = await issuePasswordReset(u.id);
        try {
          const mail = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": process.env.BREVO_API_KEY!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: {
                email: process.env.EMAIL_FROM,
                name: "ALUMNEX · ABUAD",
              },
              to: [{ email: input.email }],
              subject: "Reset your ALUMNEX password",
              textContent:
                "Use this link within 30 minutes: " +
                process.env.APP_ORIGIN +
                "/reset?token=" +
                t +
                "\nIf you did not request this, ignore this message.",
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (!mail.ok) throw new Error("Email rejected");
        } catch {
          await query(
            "UPDATE password_resets SET used_at=$1 WHERE token_hash=$2",
            [Date.now(), digest(t)],
          );
          await audit(u.id, "recovery_delivery_failed");
        }
      }
      return response({
        message: "If the account exists, a password reset email will be sent.",
      });
    }
    if (key === "auth/reset" && method === "POST") {
      const d = z
        .object({ token: z.string().length(64), password })
        .parse(await body(request));
      await limit("reset-token:" + digest(d.token), 5);
      await consumePasswordReset(d.token, d.password);
      return response(
        { message: "Password updated. Sign in with your new password." },
        200,
        { "Set-Cookie": cookie("", 0) },
      );
    }
    assert(actor, 401, "Please sign in to continue.");
    const user = actor;
    if (key === "auth/logout" && method === "POST") {
      await query("DELETE FROM sessions WHERE token_hash=$1", [
        user.token_hash,
      ]);
      await audit(user.id, "logout");
      return response({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
    }
    if (key === "profile" && method === "PATCH") {
      const d = profileSchema.parse(await body(request));
      const { name, ...profile } = d;
      assert(
        !profile.mentorAvailable || ["alumni", "admin"].includes(user.role),
        403,
        "Only alumni can offer mentorship.",
      );
      await query("UPDATE users SET name=$1,profile=$2 WHERE id=$3", [
        name,
        JSON.stringify(profile),
        user.id,
      ]);
      await audit(user.id, "profile_updated");
      return response({
        user: publicUser(
          (await one("SELECT * FROM users WHERE id=$1", [user.id]))!,
          true,
        ),
      });
    }
    if (key === "profile/password" && method === "POST") {
      const d = z
        .object({ current: z.string().max(200), password })
        .parse(await body(request));
      await limit("password-change:" + user.id, 5);
      const { compare } = await import("bcryptjs");
      assert(
        await compare(d.current, user.password_hash),
        400,
        "Current password is incorrect.",
      );
      const hash = await passwordHash(d.password);
      await transaction(async () => {
        await query("UPDATE users SET password_hash=$1 WHERE id=$2", [
          hash,
          user.id,
        ]);
        await query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
        await audit(user.id, "password_changed");
      });
      return response(
        { message: "Password changed. Please sign in again." },
        200,
        { "Set-Cookie": cookie("", 0) },
      );
    }
    if (key === "directory" && method === "GET") {
      const { limit, offset } = paging(url);
      const search = (url.searchParams.get("q") || "")
        .slice(0, 100)
        .toLowerCase();
      const rows = await query(
        "SELECT * FROM users WHERE verified=1 AND status=$1 AND (LOWER(name) LIKE $2 OR LOWER(profile) LIKE $2) ORDER BY name LIMIT $3 OFFSET $4",
        ["active", "%" + search + "%", limit, offset],
      );
      const visible = [];
      for (const u of rows) {
        try {
          await directoryProfile(u.id, user);
          visible.push(publicUser(u));
        } catch {
          /* Do not expose private profiles. */
        }
      }
      return response({ items: visible });
    }
    if (path[0] === "directory" && path.length === 2 && method === "GET") {
      const u = await directoryProfile(path[1], user);
      const feedback = await query(
        `SELECT mi.data FROM mentorship_items mi JOIN mentorships m ON mi.mentorship_id=m.id WHERE m.mentor_id=$1 AND mi.kind='feedback'`,
        [u.id],
      );
      return response({
        user: publicUser(u, u.id === user.id),
        feedback: feedback.map((r) => JSON.parse(r.data)),
        canMessage: await canMessage(user, u.id),
      });
    }
    if (key === "resources" && method === "GET") {
      const { limit, offset } = paging(url);
      const q = (url.searchParams.get("q") || "").slice(0, 100).toLowerCase(),
        kind = url.searchParams.get("kind") || "opportunity";
      assert(
        [
          "opportunity",
          "event",
          "community",
          "campaign",
          "announcement",
        ].includes(kind),
        400,
        "Unknown resource type.",
      );
      const mine = url.searchParams.get("mine") === "1";
      const rows = await query(
        `SELECT r.*,u.name AS owner_name,u.verified AS owner_verified FROM resources r JOIN users u ON r.owner_id=u.id WHERE r.kind=$1 AND ${mine ? "r.owner_id=$2" : "r.status=$2"} AND (LOWER(r.title) LIKE $3 OR LOWER(r.description) LIKE $3 OR LOWER(r.data) LIKE $3) ORDER BY r.created_at DESC LIMIT $4 OFFSET $5`,
        [kind, mine ? user.id : "published", "%" + q + "%", limit, offset],
      );
      return response({ items: dataRows(rows) });
    }
    if (key === "resources" && method === "POST") {
      const d = resourceSchema.parse(await body(request));
      publisher(user, d.kind);
      resourceDates(d.kind, d.data);
      const resourceId = id(),
        status =
          d.status === "draft"
            ? "draft"
            : user.role === "admin"
              ? "published"
              : "pending";
      await query(
        "INSERT INTO resources(id,kind,owner_id,title,description,status,data,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)",
        [
          resourceId,
          d.kind,
          user.id,
          d.title,
          d.description,
          status,
          JSON.stringify(d.data),
          Date.now(),
        ],
      );
      await audit(user.id, "resource_created", resourceId, { status });
      return response(
        {
          item: json(
            await one("SELECT * FROM resources WHERE id=$1", [resourceId]),
          ),
        },
        201,
      );
    }
    if (path[0] === "resources" && path.length === 2) {
      const r = await targetResource(path[1], user);
      if (method === "GET") {
        const saved = await one(
          "SELECT user_id FROM saved WHERE user_id=$1 AND resource_id=$2",
          [user.id, r.id],
        );
        const members = await one(
          "SELECT COUNT(*) AS count FROM memberships WHERE resource_id=$1",
          [r.id],
        );
        const raised = await one(
          "SELECT COALESCE(SUM(amount),0) AS amount,COUNT(*) AS donors FROM donations WHERE campaign_id=$1 AND status='paid'",
          [r.id],
        );
        const registration = await one(
          "SELECT id FROM registrations WHERE user_id=$1 AND resource_id=$2",
          [user.id, r.id],
        );
        return response({
          item: r,
          saved: !!saved,
          members: Number(members.count),
          raised: Number(raised.amount) / 100,
          donors: Number(raised.donors),
          registered: !!registration,
        });
      }
      if (method === "PATCH") {
        assert(
          r.owner_id === user.id || user.role === "admin",
          404,
          "Item not found.",
        );
        publisher(user, r.kind);
        const d = resourceSchema
          .omit({ kind: true })
          .parse(await body(request));
        resourceDates(r.kind, d.data);
        const status =
          d.status === "draft"
            ? "draft"
            : d.status === "closed"
              ? "closed"
              : user.role === "admin"
                ? "published"
                : "pending";
        await query(
          "UPDATE resources SET title=$1,description=$2,data=$3,status=$4,updated_at=$5 WHERE id=$6",
          [
            d.title,
            d.description,
            JSON.stringify(d.data),
            status,
            Date.now(),
            r.id,
          ],
        );
        await audit(user.id, "resource_updated", r.id, { status });
        return response({ ok: true });
      }
      if (method === "DELETE") {
        assert(
          r.owner_id === user.id || user.role === "admin",
          404,
          "Item not found.",
        );
        publisher(user, r.kind);
        await query(
          "UPDATE resources SET status=$1,updated_at=$2 WHERE id=$3",
          ["closed", Date.now(), r.id],
        );
        await audit(user.id, "resource_closed", r.id);
        return response({ ok: true });
      }
    }
    if (key === "saved" && method === "GET")
      return response({
        items: dataRows(
          await query(
            "SELECT r.* FROM saved s JOIN resources r ON s.resource_id=r.id WHERE s.user_id=$1 AND r.status='published' ORDER BY r.created_at DESC",
            [user.id],
          ),
        ),
      });
    if (path[0] === "saved" && path.length === 2) {
      await targetResource(path[1], user);
      if (method === "POST")
        await query(
          "INSERT INTO saved(user_id,resource_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [user.id, path[1]],
        );
      else if (method === "DELETE")
        await query("DELETE FROM saved WHERE user_id=$1 AND resource_id=$2", [
          user.id,
          path[1],
        ]);
      else throw new HttpError(405, "Method not allowed.");
      return response({ ok: true });
    }
    if (path[0] === "apply" && path.length === 2 && method === "POST") {
      role(user, "student", "alumni");
      const d = applicationSchema.parse(await body(request));
      const resume = await one(
        "SELECT id FROM files WHERE id=$1 AND owner_id=$2",
        [d.resumeId, user.id],
      );
      assert(resume, 400, "Upload your own resume first.");
      const applicationId = id();
      await transaction(async () => {
        const r = await targetResource(path[1], user);
        assert(
          r.kind === "opportunity" && r.status === "published",
          409,
          "This opportunity is not accepting applications.",
        );
        deadline(r.data);
        assert(
          !(await one(
            "SELECT id FROM applications WHERE user_id=$1 AND resource_id=$2",
            [user.id, r.id],
          )),
          409,
          "You have already applied to this opportunity.",
        );
        await query(
          "INSERT INTO applications(id,user_id,resource_id,status,data,created_at) VALUES($1,$2,$3,$4,$5,$6)",
          [
            applicationId,
            user.id,
            r.id,
            "submitted",
            JSON.stringify({ ...d, profile: publicUser(user, true) }),
            Date.now(),
          ],
        );
        await audit(user.id, "application_submitted", applicationId);
        await notify(
          r.owner_id,
          "New application",
          user.name + " applied for " + r.title,
          "/app/applicants",
        );
      });
      return response({ id: applicationId }, 201);
    }
    if (key === "applications" && method === "GET") {
      const managed = url.searchParams.get("managed") === "1";
      if (managed) role(user, "employer", "alumni", "admin");
      const rows = await query(
        `SELECT a.*,r.title,r.owner_id,u.name AS applicant_name FROM applications a JOIN resources r ON a.resource_id=r.id JOIN users u ON a.user_id=u.id WHERE ${managed ? (user.role === "admin" ? "1=1" : "r.owner_id=$1") : "a.user_id=$1"} ORDER BY a.created_at DESC`,
        managed && user.role === "admin" ? [] : [user.id],
      );
      return response({ items: dataRows(rows) });
    }
    if (path[0] === "applications" && path.length === 2 && method === "PATCH") {
      const d = z
        .object({
          status: z.enum([
            "under_review",
            "interview",
            "accepted",
            "rejected",
            "withdrawn",
          ]),
        })
        .parse(await body(request));
      const a = await one(
        "SELECT a.*,r.owner_id FROM applications a JOIN resources r ON a.resource_id=r.id WHERE a.id=$1",
        [path[1]],
      );
      assert(
        a &&
          (a.user_id === user.id ||
            a.owner_id === user.id ||
            user.role === "admin"),
        404,
        "Application not found.",
      );
      if (a.user_id === user.id)
        assert(
          d.status === "withdrawn",
          403,
          "Applicants may only withdraw applications.",
        );
      else {
        role(user, "alumni", "employer", "admin");
        assert(
          d.status !== "withdrawn",
          400,
          "Employers cannot withdraw an applicant’s application.",
        );
      }
      assert(a.status !== "withdrawn", 409, "This application was withdrawn.");
      await query("UPDATE applications SET status=$1 WHERE id=$2", [
        d.status,
        a.id,
      ]);
      await audit(user.id, "application_status", a.id, { status: d.status });
      await notify(
        a.user_id,
        "Application update",
        "Your application is now " + d.status.replace("_", " "),
        "/app/applications",
      );
      return response({ ok: true });
    }
    if (path[0] === "register" && path.length === 2 && method === "POST") {
      const d = z
        .object({
          phone: text(30),
          role: text(120),
          attendance: z.enum(["In-person", "Virtual"]),
          dietary: z.string().max(300),
          networking: z.string().max(500),
        })
        .parse(await body(request));
      await transaction(async () => {
        const r = await targetResource(path[1], user);
        assert(
          r.kind === "event" && r.status === "published",
          409,
          "Registration is closed.",
        );
        if (process.env.DATABASE_URL)
          await query("SELECT id FROM resources WHERE id=$1 FOR UPDATE", [
            r.id,
          ]);
        deadline(r.data);
        assert(
          Date.parse(r.data.startsAt) > Date.now(),
          409,
          "This event has already started.",
        );
        const total = await one(
          "SELECT COUNT(*) AS count FROM registrations WHERE resource_id=$1",
          [r.id],
        );
        assert(
          !r.data.capacity || Number(total.count) < Number(r.data.capacity),
          409,
          "This event is full.",
        );
        assert(
          !(await one(
            "SELECT id FROM registrations WHERE user_id=$1 AND resource_id=$2",
            [user.id, r.id],
          )),
          409,
          "You are already registered.",
        );
        await query(
          "INSERT INTO registrations(id,user_id,resource_id,data,created_at) VALUES($1,$2,$3,$4,$5)",
          [id(), user.id, r.id, JSON.stringify(d), Date.now()],
        );
        await audit(user.id, "event_registered", r.id);
        await notify(user.id, "You’re going!", r.title, "/app/events/" + r.id);
      });
      return response({ ok: true }, 201);
    }
    if (key === "registrations" && method === "GET")
      return response({
        items: dataRows(
          await query(
            "SELECT r.*,g.id AS registration_id FROM registrations g JOIN resources r ON g.resource_id=r.id WHERE g.user_id=$1 ORDER BY g.created_at DESC",
            [user.id],
          ),
        ),
      });
    if (
      path[0] === "registrations" &&
      path.length === 2 &&
      method === "DELETE"
    ) {
      await query(
        "DELETE FROM registrations WHERE user_id=$1 AND resource_id=$2",
        [user.id, path[1]],
      );
      await audit(user.id, "event_registration_cancelled", path[1]);
      return response({ ok: true });
    }
    if (path[0] === "communities" && path[2] === "membership") {
      const r = await targetResource(path[1], user);
      assert(r.kind === "community", 404, "Community not found.");
      if (method === "POST")
        await query(
          "INSERT INTO memberships(user_id,resource_id,created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [user.id, r.id, Date.now()],
        );
      else if (method === "DELETE")
        await query(
          "DELETE FROM memberships WHERE user_id=$1 AND resource_id=$2",
          [user.id, r.id],
        );
      else if (method === "GET")
        return response({
          member: !!(await one(
            "SELECT user_id FROM memberships WHERE user_id=$1 AND resource_id=$2",
            [user.id, r.id],
          )),
          members: (
            await query(
              "SELECT u.* FROM memberships m JOIN users u ON m.user_id=u.id WHERE m.resource_id=$1 AND u.verified=1 AND u.status=$2",
              [r.id, "active"],
            )
          )
            .filter(
              (u) => JSON.parse(u.profile || "{}").visibility !== "private",
            )
            .map((u) => publicUser(u)),
        });
      else throw new HttpError(405, "Method not allowed.");
      return response({ ok: true });
    }
    if (path[0] === "communities" && path[2] === "posts") {
      const r = await targetResource(path[1], user);
      assert(r.kind === "community", 404, "Community not found.");
      if (method === "GET")
        return response({
          items: await query(
            "SELECT p.*,u.name,(SELECT COUNT(*) FROM post_reactions x WHERE x.post_id=p.id) AS likes FROM community_posts p JOIN users u ON p.user_id=u.id WHERE p.resource_id=$1 ORDER BY p.created_at DESC LIMIT 60",
            [r.id],
          ),
        });
      if (method === "POST") {
        assert(
          (await one(
            "SELECT user_id FROM memberships WHERE user_id=$1 AND resource_id=$2",
            [user.id, r.id],
          )) || user.role === "admin",
          403,
          "Join the community before posting.",
        );
        const d = z.object({ body: text(5000) }).parse(await body(request));
        await query(
          "INSERT INTO community_posts(id,resource_id,user_id,body,created_at) VALUES($1,$2,$3,$4,$5)",
          [id(), r.id, user.id, d.body, Date.now()],
        );
        await audit(user.id, "community_posted", r.id);
        return response({ ok: true }, 201);
      }
    }
    if (path[0] === "posts" && path[2] === "like") {
      const post = await one("SELECT * FROM community_posts WHERE id=$1", [
        path[1],
      ]);
      assert(post, 404, "Post not found.");
      await targetResource(post.resource_id, user);
      assert(
        (await one(
          "SELECT user_id FROM memberships WHERE user_id=$1 AND resource_id=$2",
          [user.id, post.resource_id],
        )) || user.role === "admin",
        403,
        "Join the community first.",
      );
      if (method === "POST")
        await query(
          "INSERT INTO post_reactions(user_id,post_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [user.id, post.id],
        );
      else if (method === "DELETE")
        await query(
          "DELETE FROM post_reactions WHERE user_id=$1 AND post_id=$2",
          [user.id, post.id],
        );
      else throw new HttpError(405, "Method not allowed.");
      return response({ ok: true });
    }
    if (key === "connections" && method === "GET")
      return response({
        items: await query(
          `SELECT c.*,s.name AS sender_name,r.name AS receiver_name FROM connections c JOIN users s ON c.sender_id=s.id JOIN users r ON c.receiver_id=r.id WHERE c.sender_id=$1 OR c.receiver_id=$1 ORDER BY c.created_at DESC`,
          [user.id],
        ),
      });
    if (key === "connections" && method === "POST") {
      const d = z
        .object({ userId: z.string().uuid() })
        .parse(await body(request));
      assert(d.userId !== user.id, 400, "Choose another person.");
      await directoryProfile(d.userId, user);
      const pair = [user.id, d.userId].sort().join(":");
      const existing = await one(
        "SELECT * FROM connections WHERE pair_key=$1",
        [pair],
      );
      assert(!existing, 409, "A connection request already exists.");
      await query(
        "INSERT INTO connections(id,sender_id,receiver_id,pair_key,status,created_at) VALUES($1,$2,$3,$4,$5,$6)",
        [id(), user.id, d.userId, pair, "pending", Date.now()],
      );
      await notify(
        d.userId,
        "New connection request",
        user.name + " wants to connect.",
        "/app/connections",
      );
      return response({ ok: true }, 201);
    }
    if (path[0] === "connections" && path.length === 2 && method === "PATCH") {
      const d = z
        .object({ status: z.enum(["accepted", "declined", "blocked"]) })
        .parse(await body(request));
      const c = await one("SELECT * FROM connections WHERE id=$1", [path[1]]);
      assert(
        c && (c.sender_id === user.id || c.receiver_id === user.id),
        404,
        "Connection not found.",
      );
      if (d.status !== "blocked")
        assert(
          c.receiver_id === user.id && c.status === "pending",
          403,
          "Only the recipient can respond to a pending request.",
        );
      await query("UPDATE connections SET status=$1 WHERE id=$2", [
        d.status,
        c.id,
      ]);
      await audit(user.id, "connection_" + d.status, c.id);
      if (d.status === "accepted")
        await notify(
          c.sender_id,
          "Connection accepted",
          user.name + " accepted your request.",
          "/app/connections",
        );
      return response({ ok: true });
    }
    if (key === "mentorships" && method === "GET")
      return response({
        items: dataRows(
          await query(
            "SELECT m.*,s.name AS student_name,u.name AS mentor_name FROM mentorships m JOIN users s ON m.student_id=s.id JOIN users u ON m.mentor_id=u.id WHERE m.student_id=$1 OR m.mentor_id=$1 ORDER BY m.created_at DESC",
            [user.id],
          ),
        ),
      });
    if (key === "mentorships" && method === "POST") {
      role(user, "student", "alumni");
      const d = mentorshipSchema.parse(await body(request));
      const mentor = await directoryProfile(d.mentorId, user);
      assert(
        d.mentorId !== user.id &&
          mentor.role === "alumni" &&
          JSON.parse(mentor.profile || "{}").mentorAvailable,
        400,
        "This alumnus is not available for mentorship.",
      );
      assert(
        !(await one(
          "SELECT id FROM mentorships WHERE student_id=$1 AND mentor_id=$2",
          [user.id, d.mentorId],
        )),
        409,
        "A mentorship request already exists.",
      );
      const mId = id();
      await query(
        "INSERT INTO mentorships(id,student_id,mentor_id,status,data,created_at) VALUES($1,$2,$3,$4,$5,$6)",
        [mId, user.id, d.mentorId, "pending", JSON.stringify(d), Date.now()],
      );
      await notify(
        d.mentorId,
        "Mentorship request",
        user.name + " would value your guidance.",
        "/app/mentorship",
      );
      await audit(user.id, "mentorship_requested", mId);
      return response({ id: mId }, 201);
    }
    if (path[0] === "mentorships" && path.length === 2) {
      const m = await participant(path[1], user);
      if (method === "GET")
        return response({
          item: m,
          items: dataRows(
            await query(
              "SELECT * FROM mentorship_items WHERE mentorship_id=$1 ORDER BY created_at",
              [m.id],
            ),
          ),
        });
      if (method === "PATCH") {
        const d = z
          .object({
            status: z.enum(["active", "declined", "completed", "cancelled"]),
          })
          .parse(await body(request));
        if (["active", "declined"].includes(d.status))
          assert(
            m.mentor_id === user.id && m.status === "pending",
            403,
            "Only the mentor can respond to a pending request.",
          );
        if (d.status === "completed")
          assert(
            m.status === "active",
            409,
            "Only active mentorships can be completed.",
          );
        assert(
          !["declined", "completed", "cancelled"].includes(m.status),
          409,
          "This mentorship is already closed.",
        );
        await query("UPDATE mentorships SET status=$1 WHERE id=$2", [
          d.status,
          m.id,
        ]);
        await audit(user.id, "mentorship_" + d.status, m.id);
        await notify(
          m.student_id === user.id ? m.mentor_id : m.student_id,
          "Mentorship update",
          "Your mentorship is now " + d.status,
          "/app/mentorship/" + m.id,
        );
        return response({ ok: true });
      }
    }
    if (path[0] === "mentorships" && path[2] === "items" && method === "POST") {
      const m = await participant(path[1], user);
      const d = itemSchema.parse(await body(request));
      assert(
        m.status === "active" ||
          (d.kind === "feedback" && m.status === "completed"),
        409,
        "This mentorship is not active.",
      );
      if (d.kind === "feedback") {
        assert(
          m.student_id === user.id,
          403,
          "Only the mentee can leave feedback.",
        );
        assert(
          !(await one(
            "SELECT id FROM mentorship_items WHERE mentorship_id=$1 AND kind=$2",
            [m.id, "feedback"],
          )),
          409,
          "Feedback was already submitted.",
        );
      }
      await query(
        "INSERT INTO mentorship_items(id,mentorship_id,kind,owner_id,data,created_at) VALUES($1,$2,$3,$4,$5,$6)",
        [id(), m.id, d.kind, user.id, JSON.stringify(d), Date.now()],
      );
      await audit(user.id, "mentorship_item_added", m.id, { kind: d.kind });
      return response({ ok: true }, 201);
    }
    if (
      path[0] === "mentorship-items" &&
      path.length === 2 &&
      method === "PATCH"
    ) {
      const row = await one("SELECT * FROM mentorship_items WHERE id=$1", [
        path[1],
      ]);
      assert(row, 404, "Item not found.");
      const m = await participant(row.mentorship_id, user);
      assert(
        m.status === "active" && row.kind !== "feedback",
        409,
        "This item cannot be changed.",
      );
      const d = itemSchema.parse(await body(request));
      assert(d.kind === row.kind, 400, "Item type cannot change.");
      await query("UPDATE mentorship_items SET data=$1 WHERE id=$2", [
        JSON.stringify(d),
        row.id,
      ]);
      return response({ ok: true });
    }
    if (key === "messages" && method === "GET") {
      const peer = url.searchParams.get("peer");
      if (peer) {
        assert(
          await canMessage(user, peer),
          404,
          "Conversation not available.",
        );
        return response({
          items: await query(
            "SELECT * FROM messages WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1) ORDER BY created_at DESC LIMIT 100",
            [user.id, peer],
          ),
        });
      }
      const rows = await query(
        `SELECT m.*,s.name AS sender_name,r.name AS receiver_name FROM messages m JOIN users s ON m.sender_id=s.id JOIN users r ON m.receiver_id=r.id WHERE m.sender_id=$1 OR m.receiver_id=$1 ORDER BY m.created_at DESC LIMIT 200`,
        [user.id],
      );
      return response({ items: rows });
    }
    if (key === "messages" && method === "POST") {
      const d = z
        .object({ receiverId: z.string().uuid(), body: text(5000) })
        .parse(await body(request));
      await limit("message:" + user.id, 30, 60_000);
      assert(
        await canMessage(user, d.receiverId),
        403,
        "Connect with this person, or start an active mentorship, before messaging.",
      );
      await query(
        "INSERT INTO messages(id,sender_id,receiver_id,body,created_at) VALUES($1,$2,$3,$4,$5)",
        [id(), user.id, d.receiverId, d.body, Date.now()],
      );
      await notify(
        d.receiverId,
        "New message",
        user.name + " sent you a message.",
        "/app/messages/" + user.id,
      );
      return response({ ok: true }, 201);
    }
    if (path[0] === "messages" && path[2] === "read" && method === "POST") {
      assert(
        await canMessage(user, path[1]),
        404,
        "Conversation not available.",
      );
      await query(
        "UPDATE messages SET read_at=$1 WHERE sender_id=$2 AND receiver_id=$3 AND read_at IS NULL",
        [Date.now(), path[1], user.id],
      );
      return response({ ok: true });
    }
    if (key === "notifications" && method === "GET")
      return response({
        items: await query(
          "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
          [user.id],
        ),
      });
    if (key === "notifications/read" && method === "POST") {
      await query(
        "UPDATE notifications SET read_at=$1 WHERE user_id=$2 AND read_at IS NULL",
        [Date.now(), user.id],
      );
      return response({ ok: true });
    }
    if (key === "files" && method === "POST") {
      await limit("upload:" + user.id, 10, 3600_000);
      const d = z
        .object({ name: text(100), content: z.string().max(2_800_000) })
        .parse(await body(request, 2_900_000));
      const bytes = Buffer.from(d.content, "base64");
      assert(
        bytes.length <= 2 * 1024 * 1024 &&
          bytes.subarray(0, 5).toString() === "%PDF-",
        400,
        "Upload a PDF resume of up to 2 MB.",
      );
      const fileId = id();
      await query(
        "INSERT INTO files(id,owner_id,name,mime,content,created_at) VALUES($1,$2,$3,$4,$5,$6)",
        [
          fileId,
          user.id,
          d.name.replace(/[^a-zA-Z0-9._ -]/g, "_"),
          "application/pdf",
          bytes.toString("base64"),
          Date.now(),
        ],
      );
      return response({ id: fileId, name: d.name }, 201);
    }
    if (path[0] === "files" && path.length === 2 && method === "GET") {
      const file = await one("SELECT * FROM files WHERE id=$1", [path[1]]);
      assert(file, 404, "File not found.");
      let allowed = file.owner_id === user.id || user.role === "admin";
      if (!allowed) {
        const applications = await query(
          "SELECT a.data FROM applications a JOIN resources r ON a.resource_id=r.id WHERE a.user_id=$1 AND r.owner_id=$2 AND a.status<>$3",
          [file.owner_id, user.id, "withdrawn"],
        );
        allowed = applications.some(
          (a) => JSON.parse(a.data).resumeId === file.id,
        );
      }
      if (!allowed) {
        await audit(user.id, "access_denied", file.id);
        throw new HttpError(404, "File not found.");
      }
      await audit(user.id, "resume_downloaded", file.id);
      return new Response(Buffer.from(file.content, "base64"), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="' + file.name.replace(/["\r\n]/g, "_") + '"',
          "Content-Security-Policy": "sandbox; default-src 'none'",
        },
      });
    }
    if (key === "giving" && method === "GET")
      return response({
        items: await query(
          "SELECT d.*,r.title FROM donations d JOIN resources r ON d.campaign_id=r.id WHERE d.user_id=$1 ORDER BY d.created_at DESC",
          [user.id],
        ),
        configured: !!process.env.PAYSTACK_SECRET_KEY,
      });
    if (key === "giving/checkout" && method === "POST") {
      const d = z
        .object({
          campaignId: z.string().uuid(),
          amount: z.number().int().min(100).max(10000000),
        })
        .parse(await body(request));
      const r = await targetResource(d.campaignId, user);
      assert(
        r.kind === "campaign" && r.status === "published",
        409,
        "This campaign is not accepting donations.",
      );
      deadline(r.data);
      assert(
        process.env.PAYSTACK_SECRET_KEY,
        503,
        "Online giving is awaiting payment-provider setup. No payment has been taken.",
      );
      const reference = "alumnex_" + token().slice(0, 32),
        donationId = id();
      await query(
        "INSERT INTO donations(id,user_id,campaign_id,amount,reference,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          donationId,
          user.id,
          r.id,
          d.amount * 100,
          reference,
          "pending",
          Date.now(),
        ],
      );
      const result = await provider("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: user.email,
          amount: d.amount * 100,
          currency: "NGN",
          reference,
          callback_url:
            process.env.APP_ORIGIN +
            "/app/giving/confirm?reference=" +
            reference,
        }),
      });
      assert(
        /^https:\/\/checkout\.paystack\.com\//.test(result.authorization_url),
        502,
        "Unexpected checkout URL.",
      );
      return response({ url: result.authorization_url });
    }
    if (key === "giving/verify" && method === "POST") {
      const d = z.object({ reference: text(100) }).parse(await body(request));
      assert(
        await one(
          "SELECT id FROM donations WHERE reference=$1 AND user_id=$2",
          [d.reference, user.id],
        ),
        404,
        "Donation not found.",
      );
      await verifyPayment(d.reference);
      return response({ ok: true });
    }
    if (key === "support" && method === "GET")
      return response({
        items: await query(
          "SELECT * FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC",
          [user.id],
        ),
      });
    if (key === "support" && method === "POST") {
      const d = z
        .object({ subject: text(200), body: text(5000) })
        .parse(await body(request));
      await query(
        "INSERT INTO support_tickets(id,user_id,subject,body,created_at) VALUES($1,$2,$3,$4,$5)",
        [id(), user.id, d.subject, d.body, Date.now()],
      );
      return response({ ok: true }, 201);
    }
    if (key === "insights" && method === "GET") {
      const profiles = await query(
        "SELECT profile FROM users WHERE verified=1 AND role=$1 AND status=$2",
        ["alumni", "active"],
      );
      const faculties: Record<string, number> = {},
        locations: Record<string, number> = {},
        industries: Record<string, number> = {};
      for (const p of profiles) {
        const d = JSON.parse(p.profile || "{}");
        for (const [field, group] of [
          ["faculty", faculties],
          ["location", locations],
          ["industry", industries],
        ] as const) {
          const name = d[field] || "Not provided";
          group[name] = (group[name] || 0) + 1;
        }
      }
      const count = async (sql: string, p: unknown[] = []) =>
        Number((await one(sql, p))?.count || 0);
      return response({
        alumni: profiles.length,
        opportunities: await count(
          "SELECT COUNT(*) AS count FROM resources WHERE kind='opportunity' AND status='published'",
        ),
        events: await count(
          "SELECT COUNT(*) AS count FROM resources WHERE kind='event' AND status='published'",
        ),
        mentorships: await count(
          "SELECT COUNT(*) AS count FROM mentorships WHERE status='active'",
        ),
        faculties,
        locations,
        industries,
        explanation:
          "Counts are computed from verified member profiles and platform records. No predictive AI model is configured.",
      });
    }
    if (path[0] === "admin") {
      role(user, "admin");
      if (key === "admin/overview" && method === "GET") {
        const counts = {};
        for (const [label, sql] of Object.entries({
          users: "SELECT COUNT(*) AS count FROM users",
          pending: "SELECT COUNT(*) AS count FROM users WHERE verified=0",
          content:
            "SELECT COUNT(*) AS count FROM resources WHERE status='pending'",
          mentorships:
            "SELECT COUNT(*) AS count FROM mentorships WHERE status='active'",
          applications: "SELECT COUNT(*) AS count FROM applications",
          raised:
            "SELECT COALESCE(SUM(amount),0) AS count FROM donations WHERE status='paid'",
          tickets:
            "SELECT COUNT(*) AS count FROM support_tickets WHERE status='open'",
        }))
          (counts as Row)[label] = Number((await one(sql)).count);
        return response({ counts });
      }
      if (key === "admin/users" && method === "GET")
        return response({
          items: (
            await query(
              "SELECT * FROM users ORDER BY created_at DESC LIMIT 500",
            )
          ).map((u) => publicUser(u, true)),
        });
      if (path[1] === "users" && path.length === 3 && method === "PATCH") {
        const d = z
          .object({
            role: z.enum(["student", "alumni", "employer", "admin"]),
            status: z.enum(["active", "suspended"]),
            verified: z.boolean(),
          })
          .parse(await body(request));
        assert(
          path[2] !== user.id,
          400,
          "Use another administrator to change your own privileges or status.",
        );
        await transaction(async () => {
          await query(
            "SELECT id FROM users WHERE role='admin'" +
              (process.env.DATABASE_URL ? " FOR UPDATE" : ""),
          );
          const currentActor = await one(
            "SELECT role,status FROM users WHERE id=$1",
            [user.id],
          );
          assert(
            currentActor?.role === "admin" && currentActor?.status === "active",
            403,
            "Administrator access was revoked.",
          );
          const target = await one("SELECT * FROM users WHERE id=$1", [
            path[2],
          ]);
          assert(target, 404, "User not found.");
          await query(
            "UPDATE users SET role=$1,status=$2,verified=$3 WHERE id=$4",
            [d.role, d.status, d.verified ? 1 : 0, target.id],
          );
          if (target.role !== d.role || d.status === "suspended")
            await query("DELETE FROM sessions WHERE user_id=$1", [target.id]);
          await audit(user.id, "user_admin_updated", target.id, d);
        });
        return response({ ok: true });
      }
      if (key === "admin/resources" && method === "GET")
        return response({
          items: dataRows(
            await query(
              "SELECT r.*,u.name AS owner_name FROM resources r JOIN users u ON r.owner_id=u.id ORDER BY r.created_at DESC LIMIT 500",
            ),
          ),
        });
      if (path[1] === "resources" && path.length === 3 && method === "PATCH") {
        const d = z
          .object({ status: z.enum(["published", "rejected", "closed"]) })
          .parse(await body(request));
        const r = await one("SELECT * FROM resources WHERE id=$1", [path[2]]);
        assert(r, 404, "Item not found.");
        await query(
          "UPDATE resources SET status=$1,updated_at=$2 WHERE id=$3",
          [d.status, Date.now(), r.id],
        );
        await audit(user.id, "resource_moderated", r.id, d);
        await notify(
          r.owner_id,
          "Publication update",
          r.title + " is now " + d.status,
          "/app/manage",
        );
        return response({ ok: true });
      }
      if (key === "admin/mentorships" && method === "GET")
        return response({
          items: dataRows(
            await query(
              "SELECT m.*,s.name AS student_name,u.name AS mentor_name FROM mentorships m JOIN users s ON m.student_id=s.id JOIN users u ON m.mentor_id=u.id ORDER BY m.created_at DESC LIMIT 500",
            ),
          ),
        });
      if (key === "admin/audit" && method === "GET")
        return response({
          items: await query(
            "SELECT a.*,u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON a.actor_id=u.id ORDER BY a.created_at DESC LIMIT 300",
          ),
        });
      if (key === "admin/support" && method === "GET")
        return response({
          items: await query(
            "SELECT t.*,u.name FROM support_tickets t JOIN users u ON t.user_id=u.id ORDER BY t.created_at DESC LIMIT 200",
          ),
        });
      if (path[1] === "support" && path.length === 3 && method === "PATCH") {
        const d = z
          .object({ response: text(5000), status: z.enum(["open", "closed"]) })
          .parse(await body(request));
        const t = await one("SELECT * FROM support_tickets WHERE id=$1", [
          path[2],
        ]);
        assert(t, 404, "Ticket not found.");
        await query(
          "UPDATE support_tickets SET response=$1,status=$2 WHERE id=$3",
          [d.response, d.status, t.id],
        );
        await audit(user.id, "support_responded", t.id);
        await notify(t.user_id, "Support update", t.subject, "/app/support");
        return response({ ok: true });
      }
      if (key === "admin/announcements" && method === "POST") {
        const d = z
          .object({
            title: text(150),
            body: text(5000),
            faculty: z.string().max(100),
            location: z.string().max(100),
          })
          .parse(await body(request));
        const users = await query(
          "SELECT id,profile FROM users WHERE status=$1",
          ["active"],
        );
        let sent = 0;
        await transaction(async () => {
          for (const u of users) {
            const p = JSON.parse(u.profile || "{}");
            if (
              (!d.faculty || p.faculty === d.faculty) &&
              (!d.location || p.location === d.location)
            ) {
              await notify(u.id, d.title, d.body, "/app/notifications");
              sent++;
            }
          }
          await audit(user.id, "announcement_sent", "", { count: sent });
        });
        return response({ count: sent });
      }
      if (key === "admin/export" && method === "GET") {
        const rows = await query(
          "SELECT name,email,role,verified,status,created_at FROM users ORDER BY name",
        );
        const escape = (v: unknown) =>
          '"' +
          String(v ?? "")
            .replace(/^[=+@\-\t\r]/, "'$&")
            .replace(/"/g, '""') +
          '"';
        const csv = [
          "Name,Email,Role,Verified,Status,Created",
          ...rows.map((r) => Object.values(r).map(escape).join(",")),
        ].join("\r\n");
        await audit(user.id, "users_exported");
        return new Response(csv, {
          headers: {
            ...headers,
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="alumnex-users.csv"',
          },
        });
      }
    }
    throw new HttpError(404, "This endpoint was not found.");
  } catch (error) {
    if (error instanceof z.ZodError)
      return response(
        {
          error: error.issues[0]?.message || "Check the form fields.",
          fields: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        400,
      );
    if (error instanceof HttpError) {
      if (actor && [403, 404].includes(error.status))
        await audit(actor.id, "access_denied", key).catch(() => {});
      return response({ error: error.message }, error.status);
    }
    if (
      (error as any)?.code === "23505" ||
      String((error as any)?.message).includes("UNIQUE constraint")
    )
      return response(
        {
          error:
            "This action was already completed. Refresh to see the latest status.",
        },
        409,
      );
    console.error("ALUMNEX request failure", {
      path: key,
      code: (error as any)?.code || "internal",
    });
    return response(
      { error: "The request could not be completed. Please try again." },
      500,
    );
  }
}
