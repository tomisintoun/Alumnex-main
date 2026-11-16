# ALUMNEX · ABUAD Alumni Network

A responsive alumni, mentorship and careers platform for Afe Babalola University, Ado-Ekiti. This is a project implementation, not an official university service or endorsement.

## Run locally

Requires Node.js 24 or newer. The committed lockfile pins dependencies.

```bash
npm ci
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Sign up as a student, alumnus or employer. Successful signup goes to profile setup; login goes to the dashboard. Development uses a persistent SQLite database in `.data/` unless `DATABASE_URL` is supplied. SQLite is rejected in production.

For fictional development records, set `SEED_DEMO=true` in `.env.local`, then run `npm run db:migrate`. Example profiles cannot be signed into: they have an unshared random password and `.invalid` email addresses. Seeding is blocked in production. All generated portraits represent fictional people.

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`. Install Node 24, then run the same npm commands.

## Set up the first administrator

1. Create the intended account through Sign Up.
2. From a trusted terminal connected to the **same database**, run:

```bash
npm run admin -- your-existing-account@example.com
```

3. Sign in again. This command grants the existing account administrator access and revokes its sessions. No default administrator password or public admin signup exists.

Administrators verify student, alumni and employer accounts, approve public listings, manage member roles/status, respond to support requests, send targeted in-platform announcements, inspect data summaries, and review append-only audit logs.

## Implemented workflows

- Welcome, signup, sign-in, password recovery (Brevo configuration required), secure sign-out, profile onboarding and privacy controls.
- Alumni discovery with search, faculty and industry filters, private profile visibility, and mentor availability.
- Connection requests, recipient acceptance/decline, blocking and private text messaging. Messages refresh every eight seconds while a conversation is open; this is polling, not WebSocket push.
- Mentorship requests, mentor acceptance, active/completed/cancelled relationships, goals, goal completion, scheduled sessions, resources and one-time feedback.
- Employer/alumni opportunity creation, administrator moderation, published listings, work/type/search filters, saved opportunities and a six-step application journey.
- Private PDF resumes, authorized employer downloads, application review/status changes and applicant withdrawal.
- Event creation, registration deadlines, atomic capacity checks, registrations, cancellation and calendar export.
- Communities, member visibility, joining/leaving, posts and likes, with industry-related opportunities/events.
- Administrator-approved campaigns, NGN checkout, provider verification, HMAC-authenticated webhook, private giving history and downloadable text receipts. Paystack must be configured before payments are possible.
- Live database-backed faculty, location, industry and mentorship summaries. These are descriptive summaries; no predictive or generative AI model is configured.
- Support tickets and administrator responses, notifications, in-platform audience-targeted announcements and protected CSV export.

## PowerBill requirements mapped to ALUMNEX

| Requirement                        | Implementation                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Home/dashboard                     | Landing page and authenticated network dashboard                                                                        |
| Registration/login/logout          | Server routes, bcrypt, secure cookies and session rotation                                                              |
| Profile/navigation/forms/search    | Profile editor, sidebar and mobile navigation, server-validated forms and resource/member search                        |
| Role-based access                  | Student, alumni, employer and administrator; authorization on every server action                                       |
| Password hashing                   | bcrypt cost 12, 10-character minimum, 72-byte maximum                                                                   |
| Input validation                   | Zod schemas, body-size limits and PDF file checks                                                                       |
| SQL injection defense              | Parameterized PostgreSQL/SQLite queries, fixed server-controlled identifiers                                            |
| XSS defense                        | React-escaped text; no user HTML; nonce CSP; sandboxed attachment downloads                                             |
| Session management                 | HttpOnly/Secure production cookies, SameSite=Lax, hashed tokens, 30-minute idle timeout, absolute expiry and revocation |
| CSRF/access checks                 | Session-bound CSRF header, Origin/Sec-Fetch-Site checks and row ownership checks                                        |
| Sensitive information              | Private resumes, applications, messages, support and donation history; no client storage of credentials/tokens          |
| HTTPS/security config              | HTTPS origin required in production, HSTS, CSP, frame/no-sniff/referrer/permissions headers                             |
| Security explanation               | `/security` page                                                                                                        |
| Functional/security/database tests | `tests/workflows.test.ts`, run against SQLite and embedded PostgreSQL (PGlite)                                          |
| Responsive/usability               | Desktop/tablet/mobile CSS, mobile navigation, labeled forms, keyboard dialog controls and reduced-motion support        |
| Deployment                         | PostgreSQL configuration, environment example, Render Blueprint and GitHub Actions                                      |
| Backups                            | `pg_dump` helper and recovery guidance in `docs/OPERATIONS.md`                                                          |

Electricity-specific meter/tariff/bill workflows are replaced by alumni-platform workflows. VAT is not applied to donations.

## Validate

```bash
npm run typecheck
npm test
npm run test:postgres
npm run build
```

On PowerShell, run the PostgreSQL test as `$env:ALUMNEX_TEST_POSTGRES='1'; npm test; Remove-Item Env:ALUMNEX_TEST_POSTGRES`.

`npm run test:http` launches a temporary development server on port 3010, uses an isolated database and test account, then shuts it down. See `docs/TEST_REPORT.md` for checks actually run and verification limits. Browser testing at 390, 768 and 1440 pixels still requires a browser-enabled environment.

## Deploy to Render

1. Upload this folder’s contents to a **new dedicated GitHub repository**. Do not upload `.env.local`, `.data`, backups, `.next` or `node_modules`.
2. Connect that repository to Render and select this `render.yaml` Blueprint.
3. Supply a **dedicated PostgreSQL** `DATABASE_URL` (Supabase, Neon or another PostgreSQL host). Use the provider’s TLS connection string. No existing database is modified by this source package.
4. Set `APP_ORIGIN` to the actual HTTPS site origin, with no path. The app binds to Render’s `PORT`.
5. After deployment, create your account and grant the first admin using a trusted operator terminal and the same database.
6. Configure recovery email and payment keys only when those features should be enabled. See `docs/OPERATIONS.md`.

The Blueprint does not provision a paid database, copy credentials between services, or reuse another application’s database. `plan: free` is explicitly selected for the app. Current Render references: https://render.com/docs/blueprint-spec and https://render.com/docs/compute-plans.

## Important delivery limits

This source is not a claim that every optional feature in the 93-section Figma brief is production-integrated. Google OAuth, voice/video calls, voice notes, image/document chat attachments, community reply threads, recurring billing, newsletter email campaigns, predictive AI and an external map provider are not implemented. They are not represented by fake success buttons. Scheduled mentorship sessions are calendar records; meeting infrastructure must be integrated separately.

The generated Figma draft could not be retrieved again because its account tool quota was exhausted. This implementation follows the supplied written brief and the layouts authored in this conversation; pixel-level comparison with the entire Figma file was not possible. No live GitHub repository, production database, email service, payment account or Render service has been created by this package.
