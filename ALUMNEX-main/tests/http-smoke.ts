import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir, rm } from "node:fs/promises";
import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
const origin = "http://127.0.0.1:3010",
  path = ".data/http-" + randomUUID() + ".sqlite";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3010",
  ],
  {
    env: {
      ...process.env,
      ALUMNEX_HTTP_TEST: "1",
      NODE_ENV: "development",
      APP_ORIGIN: origin,
      SQLITE_PATH: path,
      SEED_DEMO: "false",
      DATABASE_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let log = "";
server.stdout.on("data", (d) => {
  log += String(d);
});
server.stderr.on("data", (d) => {
  log += String(d);
});
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) break;
    try {
      const r = await fetch(origin + "/api/health", {
        signal: AbortSignal.timeout(1000),
      });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await wait(500);
  }
  assert.ok(ready, "Temporary test server did not start: " + log.slice(-3000));
  const page = await fetch(origin + "/login");
  assert.equal(page.status, 200);
  const html = await page.text(),
    csp = page.headers.get("Content-Security-Policy") || "";
  assert.ok(csp.includes("frame-ancestors 'none'"));
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce);
  assert.ok(
    html.includes('nonce="' + nonce + '"'),
    "SSR scripts must use the request CSP nonce",
  );
  assert.ok(html.includes("Welcome back."));
  assert.equal(page.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(page.headers.get("X-Frame-Options"), "DENY");
  const session = await fetch(origin + "/api/session"),
    anonymous = await session.json();
  const anonymousCookie = session.headers.get("set-cookie")!.split(";")[0];
  const credentials = {
    name: "HTTP Test",
    email: "http-" + randomUUID() + "@example.test",
    password: "Long-passphrase-HTTP!",
    role: "student",
  };
  const signup = await fetch(origin + "/api/auth/signup", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: anonymousCookie,
      "Content-Type": "application/json",
      "X-CSRF-Token": anonymous.csrf,
    },
    body: JSON.stringify(credentials),
  });
  assert.equal(signup.status, 201, await signup.clone().text());
  const signed = await signup.json(),
    cookie = signup.headers.get("set-cookie")!.split(";")[0];
  assert.ok(signup.headers.get("set-cookie")!.includes("HttpOnly"));
  assert.ok(signup.headers.get("set-cookie")!.includes("SameSite=Lax"));
  assert.ok(!("token" in signed));
  const req = (endpoint: string, method = "GET", data?: unknown) =>
    fetch(origin + "/api/" + endpoint, {
      method,
      headers: {
        Origin: origin,
        Cookie: cookie,
        "X-CSRF-Token": signed.csrf,
        "Content-Type": "application/json",
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  assert.equal((await req("session")).status, 200);
  assert.equal((await req("admin/users")).status, 403);
  const ticket = await req("support", "POST", {
    subject: "HTTP integration check",
    body: "Testing form → API → persistent database → response.",
  });
  assert.equal(ticket.status, 201);
  const tickets = await (await req("support")).json();
  assert.equal(tickets.items.length, 1);
  assert.equal(tickets.items[0].subject, "HTTP integration check");
  assert.equal(
    (
      await fetch(origin + "/api/support", {
        method: "POST",
        headers: {
          Origin: "https://attacker.test",
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-CSRF-Token": signed.csrf,
        },
        body: JSON.stringify({ subject: "Bad", body: "Cross site" }),
      })
    ).status,
    403,
  );
  for (const route of [
    "/",
    "/signup",
    "/reset",
    "/security",
    "/app",
    "/app/opportunities",
    "/app/messages",
    "/app/settings",
  ])
    assert.equal(
      (await fetch(origin + route, { headers: { Cookie: cookie } })).status,
      200,
      route,
    );
  assert.equal((await req("auth/logout", "POST", {})).status, 200);
  assert.equal((await req("support")).status, 401);
  const newSession = await fetch(origin + "/api/session"),
    newAnonymous = await newSession.json();
  const login = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: newSession.headers.get("set-cookie")!.split(";")[0],
      "X-CSRF-Token": newAnonymous.csrf,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
      remember: true,
    }),
  });
  assert.equal(login.status, 200, await login.clone().text());
  assert.notEqual(
    login.headers.get("set-cookie")!.split(";")[0],
    cookie,
    "Login must rotate the session token",
  );
  assert.ok(login.headers.get("set-cookie")!.includes("Max-Age=604800"));
  await mkdir("docs", { recursive: true });
  await writeFile(
    "docs/http-test-result.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "SSR login rendering",
          "nonce CSP matches scripts",
          "security headers",
          "signup cookie attributes",
          "session/private endpoint",
          "admin denial",
          "support form data persistence",
          "cross-origin rejection",
          "main route responses",
          "POST logout/session revocation",
        ],
        browserTested: false,
      },
      null,
      2,
    ),
  );
  console.log(
    "HTTP integration: 10 check groups passed. Browser interaction/visual testing was not performed.",
  );
} finally {
  server.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    if (server.exitCode !== null) return resolve();
    server.once("exit", () => resolve());
    setTimeout(() => {
      server.kill("SIGKILL");
      resolve();
    }, 3000).unref();
  });
  await Promise.all(
    [path, path + "-wal", path + "-shm"].map((p) =>
      rm(p, { force: true }).catch(() => {}),
    ),
  );
}
