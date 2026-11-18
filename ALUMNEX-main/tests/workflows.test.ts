import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../lib/api";
import { id, query, one, closeDatabase } from "../lib/db";
import {
  consumePasswordReset,
  issuePasswordReset,
  digest,
  sessionFor,
} from "../lib/security";
import { settlePayment, paymentSignature } from "../lib/payments";
Object.assign(process.env, {
  NODE_ENV: "test",
  SQLITE_PATH: ":memory:",
  APP_ORIGIN: "http://localhost:3000",
});
type Client = { cookie: string; csrf: string; user?: any };
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  c?: Client,
  headers: Record<string, string> = {},
) {
  return handle(
    new Request("http://localhost:3000/api/" + path, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        ...(c ? { Cookie: c.cookie, "X-CSRF-Token": c.csrf } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    path.split("?")[0].split("/"),
  );
}
async function anonymous() {
  const r = await request("session");
  const d = await r.json();
  return { cookie: r.headers.get("set-cookie")!.split(";")[0], csrf: d.csrf };
}
async function signup(name: string, role = "student") {
  const c = await anonymous();
  const r = await request(
    "auth/signup",
    "POST",
    {
      name,
      email: name.toLowerCase() + "@example.test",
      password: "Long-passphrase-123!",
      role,
    },
    c,
  );
  assert.equal(r.status, 201, await r.clone().text());
  const d = await r.json();
  return {
    cookie: r.headers.get("set-cookie")!.split(";")[0],
    csrf: d.csrf,
    user: d.user,
  } satisfies Client;
}
async function resource(
  c: Client,
  kind: string,
  data: Record<string, any> = {},
) {
  const r = await request(
    "resources",
    "POST",
    {
      kind,
      title: "ABUAD " + kind,
      description: "A useful opportunity for our university community.",
      status: "published",
      data,
    },
    c,
  );
  assert.equal(r.status, 201, await r.clone().text());
  return (await r.json()).item;
}
test("ALUMNEX security requirements and complete workflows", async (t) => {
  const student = await signup("Student"),
    other = await signup("Other"),
    employer = await signup("Employer", "employer"),
    mentor = await signup("Mentor", "alumni"),
    admin = await signup("Admin", "alumni");
  await query("UPDATE users SET role='admin',verified=1 WHERE id=$1", [
    admin.user.id,
  ]);
  await query("UPDATE users SET verified=1 WHERE id=$1", [employer.user.id]);
  await query("UPDATE users SET verified=1,profile=$1 WHERE id=$2", [
    JSON.stringify({
      mentorAvailable: true,
      visibility: "network",
      messages: "connections",
    }),
    mentor.user.id,
  ]);
  let opportunity: any,
    event: any,
    campaign: any,
    community: any,
    applicationId = "",
    resumeId = "",
    mentorshipId = "";
  await t.test(
    "signups cannot assign admin, passwords are hashed, session token hashes are stored",
    async () => {
      const a = await anonymous();
      assert.equal(
        (
          await request(
            "auth/signup",
            "POST",
            {
              name: "Attack",
              email: "attack@example.test",
              password: "Long-passphrase-123!",
              role: "admin",
            },
            a,
          )
        ).status,
        400,
      );
      const u = await one("SELECT password_hash FROM users WHERE id=$1", [
        student.user.id,
      ]);
      assert.ok(u.password_hash.startsWith("$2"));
      assert.notEqual(u.password_hash, "Long-passphrase-123!");
      const raw = student.cookie.split("=")[1];
      assert.ok(
        await one("SELECT token_hash FROM sessions WHERE token_hash=$1", [
          digest(raw),
        ]),
      );
      assert.equal(
        await one("SELECT token_hash FROM sessions WHERE token_hash=$1", [raw]),
        null,
      );
    },
  );
  await t.test("authentication, CSRF, Origin and role boundaries", async () => {
    assert.equal((await request("admin/users")).status, 401);
    assert.equal(
      (await request("admin/users", "GET", undefined, student)).status,
      403,
    );
    assert.equal(
      (
        await request(
          "connections",
          "POST",
          { userId: mentor.user.id },
          student,
          { "X-CSRF-Token": "wrong" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "connections",
          "POST",
          { userId: mentor.user.id },
          student,
          { Origin: "https://attacker.test" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "resources",
          "POST",
          {
            kind: "campaign",
            title: "Bad",
            description: "Bad",
            status: "published",
            data: {},
          },
          student,
        )
      ).status,
      403,
    );
    assert.equal(
      (await request("auth/logout", "GET", undefined, student)).status,
      404,
    );
  });
  await t.test(
    "publication approval and server-checked ownership",
    async () => {
      opportunity = await resource(employer, "opportunity", {
        type: "Internship",
        deadline: new Date(Date.now() + 86400000).toISOString(),
      });
      assert.equal(opportunity.status, "pending");
      assert.equal(
        (
          await request(
            "resources/" + opportunity.id,
            "GET",
            undefined,
            student,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(
            "resources/" + opportunity.id,
            "DELETE",
            undefined,
            other,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(
            "admin/resources/" + opportunity.id,
            "PATCH",
            { status: "published" },
            student,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "admin/resources/" + opportunity.id,
            "PATCH",
            { status: "published" },
            admin,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("resources?kind=opportunity", "GET", undefined, student))
          .status,
        200,
      );
      assert.equal(
        (
          await request(
            "resources/" + opportunity.id,
            "GET",
            undefined,
            student,
          )
        ).status,
        200,
      );
    },
  );
  await t.test(
    "private PDF upload, application, duplicate prevention and employer review",
    async () => {
      assert.equal(
        (
          await request(
            "files",
            "POST",
            {
              name: "evil.pdf",
              content: Buffer.from("<script>alert(1)</script>").toString(
                "base64",
              ),
            },
            student,
          )
        ).status,
        400,
      );
      const file = await request(
        "files",
        "POST",
        {
          name: "cv.pdf",
          content: Buffer.from("%PDF-1.4\nTest resume").toString("base64"),
        },
        student,
      );
      assert.equal(file.status, 201);
      resumeId = (await file.json()).id;
      const payload = {
        answers: "My research interests match this internship.",
        availability: "June",
        resumeId,
        consent: true,
      };
      assert.equal(
        (await request("apply/" + opportunity.id, "POST", payload, other))
          .status,
        400,
      );
      const responses = await Promise.all([
        request("apply/" + opportunity.id, "POST", payload, student),
        request("apply/" + opportunity.id, "POST", payload, student),
      ]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      applicationId = (await responses.find((r) => r.status === 201)!.json())
        .id;
      assert.equal(
        (await request("files/" + resumeId, "GET", undefined, other)).status,
        404,
      );
      const download = await request(
        "files/" + resumeId,
        "GET",
        undefined,
        employer,
      );
      assert.equal(download.status, 200);
      assert.ok(
        download.headers.get("Content-Disposition")?.startsWith("attachment"),
      );
      assert.equal(
        (
          await request(
            "applications/" + applicationId,
            "PATCH",
            { status: "accepted" },
            student,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "applications/" + applicationId,
            "PATCH",
            { status: "interview" },
            employer,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "applications/" + applicationId,
            "PATCH",
            { status: "rejected" },
            other,
          )
        ).status,
        404,
      );
    },
  );
  await t.test(
    "deadline protection, event capacity and duplicate registration",
    async () => {
      const expired = await resource(admin, "opportunity", {
        deadline: new Date(Date.now() - 1000).toISOString(),
      });
      assert.equal(
        (
          await request(
            "apply/" + expired.id,
            "POST",
            { answers: "Test", availability: "Now", resumeId, consent: true },
            student,
          )
        ).status,
        409,
      );
      event = await resource(admin, "event", {
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        capacity: 1,
      });
      const payload = {
        phone: "08000000000",
        role: "Student",
        attendance: "Virtual",
        dietary: "",
        networking: "",
      };
      const responses = await Promise.all([
        request("register/" + event.id, "POST", payload, student),
        request("register/" + event.id, "POST", payload, other),
      ]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      assert.equal(
        Number(
          (
            await one(
              "SELECT COUNT(*) AS count FROM registrations WHERE resource_id=$1",
              [event.id],
            )
          ).count,
        ),
        1,
      );
    },
  );
  await t.test(
    "community membership required, content stored as text and parameterized search",
    async () => {
      community = await resource(admin, "community");
      assert.equal(
        (
          await request(
            "communities/" + community.id + "/posts",
            "POST",
            { body: "Hi" },
            student,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "communities/" + community.id + "/membership",
            "POST",
            {},
            student,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "communities/" + community.id + "/posts",
            "POST",
            { body: "<script>alert(1)</script>" },
            student,
          )
        ).status,
        201,
      );
      const posts = await (
        await request(
          "communities/" + community.id + "/posts",
          "GET",
          undefined,
          student,
        )
      ).json();
      assert.equal(posts.items[0].body, "<script>alert(1)</script>");
      const result = await request(
        "directory?q=" + encodeURIComponent("' OR 1=1; DROP TABLE users;--"),
        "GET",
        undefined,
        student,
      );
      assert.equal(result.status, 200);
      assert.equal((await result.json()).items.length, 0);
      assert.ok(
        await one("SELECT id FROM users WHERE id=$1", [student.user.id]),
      );
    },
  );
  await t.test(
    "connection consent, private messages and blocking",
    async () => {
      assert.equal(
        (
          await request(
            "messages",
            "POST",
            { receiverId: mentor.user.id, body: "Hello" },
            student,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "connections",
            "POST",
            { userId: mentor.user.id },
            student,
          )
        ).status,
        201,
      );
      const c = await one("SELECT * FROM connections WHERE sender_id=$1", [
        student.user.id,
      ]);
      assert.equal(
        (
          await request(
            "connections/" + c.id,
            "PATCH",
            { status: "accepted" },
            student,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "connections/" + c.id,
            "PATCH",
            { status: "accepted" },
            mentor,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "messages",
            "POST",
            { receiverId: mentor.user.id, body: "Hello mentor" },
            student,
          )
        ).status,
        201,
      );
      assert.equal(
        (
          await request(
            "messages?peer=" + mentor.user.id,
            "GET",
            undefined,
            other,
          )
        ).status,
        404,
      );
      const own = await (
        await request(
          "messages?peer=" + mentor.user.id,
          "GET",
          undefined,
          student,
        )
      ).json();
      assert.equal(own.items[0].body, "Hello mentor");
      assert.equal(
        (
          await request(
            "connections/" + c.id,
            "PATCH",
            { status: "blocked" },
            mentor,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "messages",
            "POST",
            { receiverId: mentor.user.id, body: "Blocked attempt" },
            student,
          )
        ).status,
        403,
      );
    },
  );
  await t.test(
    "mentorship request, consent, goal updates and private relationship access",
    async () => {
      const m = await request(
        "mentorships",
        "POST",
        {
          mentorId: mentor.user.id,
          reason: "Career guidance",
          goal: "Become a health researcher",
          learn: "Research methods",
          format: "Video",
          frequency: "Monthly",
        },
        student,
      );
      assert.equal(m.status, 201);
      mentorshipId = (await m.json()).id;
      assert.equal(
        (
          await request(
            "mentorships/" + mentorshipId,
            "PATCH",
            { status: "active" },
            student,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "mentorships/" + mentorshipId,
            "PATCH",
            { status: "active" },
            mentor,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("mentorships/" + mentorshipId, "GET", undefined, other))
          .status,
        404,
      );
      assert.equal(
        (
          await request(
            "mentorships/" + mentorshipId + "/items",
            "POST",
            { kind: "goal", title: "Prepare CV", done: false },
            student,
          )
        ).status,
        201,
      );
      const item = await one(
        "SELECT * FROM mentorship_items WHERE mentorship_id=$1",
        [mentorshipId],
      );
      assert.equal(
        (
          await request(
            "mentorship-items/" + item.id,
            "PATCH",
            { kind: "goal", title: "Prepare CV", done: true },
            mentor,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "mentorships/" + mentorshipId,
            "PATCH",
            { status: "completed" },
            student,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "mentorships/" + mentorshipId + "/items",
            "POST",
            { kind: "feedback", title: "Helpful mentorship", rating: 5 },
            student,
          )
        ).status,
        201,
      );
      assert.equal(
        (
          await request(
            "mentorships/" + mentorshipId + "/items",
            "POST",
            { kind: "feedback", title: "Duplicate", rating: 5 },
            student,
          )
        ).status,
        409,
      );
    },
  );
  await t.test(
    "donation amounts are server-verified, no fake success and idempotent settlement",
    async () => {
      campaign = await resource(admin, "campaign", { goal: 150000 });
      assert.equal(
        (
          await request(
            "giving/checkout",
            "POST",
            { campaignId: campaign.id, amount: 25000 },
            student,
          )
        ).status,
        503,
      );
      const reference = "test_" + id(),
        donationId = id();
      await query(
        "INSERT INTO donations(id,user_id,campaign_id,amount,reference,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          donationId,
          student.user.id,
          campaign.id,
          2500000,
          reference,
          "pending",
          Date.now(),
        ],
      );
      const payment = {
        id: "provider-123",
        status: "success",
        amount: 2500000,
        reference,
        currency: "NGN",
        customer: { email: student.user.email },
      };
      await assert.rejects(
        () => settlePayment(reference, { ...payment, amount: 100 }),
        /did not match/,
      );
      assert.equal(
        (await one("SELECT status FROM donations WHERE id=$1", [donationId]))
          .status,
        "pending",
      );
      await settlePayment(reference, payment);
      await settlePayment(reference, payment);
      assert.equal(
        Number(
          (
            await one(
              "SELECT COUNT(*) AS count FROM donations WHERE status=$1",
              ["paid"],
            )
          ).count,
        ),
        1,
      );
      assert.equal(paymentSignature("anything", "bogus"), false);
    },
  );
  await t.test(
    "account lockout and indistinguishable invalid sign-in errors",
    async () => {
      const anonymousClient = await anonymous();
      for (let i = 0; i < 5; i++) {
        const r = await request(
          "auth/login",
          "POST",
          { email: "unknown@example.test", password: "Wrong-password" },
          anonymousClient,
        );
        assert.equal(r.status, 401);
        assert.equal((await r.json()).error, "Email or password is incorrect.");
      }
      assert.equal(
        (
          await request(
            "auth/login",
            "POST",
            { email: "unknown@example.test", password: "Wrong-password" },
            anonymousClient,
          )
        ).status,
        429,
      );
    },
  );
  await t.test(
    "session expiry, reset link one-time use and session revocation",
    async () => {
      const s = await sessionFor({ id: other.user.id });
      const expired = { cookie: s.cookie.split(";")[0], csrf: s.csrf };
      await query("UPDATE sessions SET expires_at=$1 WHERE token_hash=$2", [
        Date.now() - 1,
        digest(expired.cookie.split("=")[1]),
      ]);
      assert.equal(
        (await request("directory", "GET", undefined, expired)).status,
        401,
      );
      const reset = await issuePasswordReset(other.user.id);
      await consumePasswordReset(reset, "New-long-passphrase-123!");
      await assert.rejects(
        () => consumePasswordReset(reset, "Another-long-passphrase!"),
        /invalid or expired/,
      );
      assert.equal(
        (await request("directory", "GET", undefined, other)).status,
        401,
      );
    },
  );
  await t.test(
    "audit immutability, role revocation and administrator self-protection",
    async () => {
      const a = await one("SELECT id FROM audit_logs LIMIT 1");
      await assert.rejects(
        () => query("DELETE FROM audit_logs WHERE id=$1", [a.id]),
        /append only/,
      );
      await assert.rejects(
        () =>
          query("UPDATE audit_logs SET event=$1 WHERE id=$2", [
            "changed",
            a.id,
          ]),
        /append only/,
      );
      assert.equal(
        (
          await request(
            "admin/users/" + admin.user.id,
            "PATCH",
            { role: "student", status: "active", verified: true },
            admin,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "admin/users/" + employer.user.id,
            "PATCH",
            { role: "employer", status: "suspended", verified: true },
            admin,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("directory", "GET", undefined, employer)).status,
        401,
      );
    },
  );
  await closeDatabase();
});
