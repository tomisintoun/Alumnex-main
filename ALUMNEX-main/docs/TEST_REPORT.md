# Validation report

## Automated checks performed

The workflow suite ran successfully against both development SQLite and an embedded PostgreSQL engine (PGlite). This checks actual SQL execution and PostgreSQL trigger/RLS syntax without requiring production credentials.

| Check group                                                                                     | Result |
| ----------------------------------------------------------------------------------------------- | ------ |
| Signup rejects administrator role; passwords hashed; session token hashes stored                | Passed |
| Authentication, CSRF, same-origin and role boundaries                                           | Passed |
| Publication approval and resource ownership                                                     | Passed |
| Private PDF upload/download; application submission; duplicate application prevention           | Passed |
| Deadline rejection; serialized event-capacity checks                                            | Passed |
| Community membership requirement; parameterized search; user content stored as text             | Passed |
| Recipient-only connection acceptance; message consent; blocking                                 | Passed |
| Mentorship acceptance, participant access, goal completion and one-time feedback                | Passed |
| Donation amount/reference verification, no unconfigured-provider success, idempotent settlement | Passed |
| Temporary lockout and generic invalid-login errors                                              | Passed |
| Session expiry, one-time password recovery and session revocation                               | Passed |
| Immutable audit records, suspension revocation and administrator self-protection                | Passed |

The HTTP integration check launched an actual Next.js development server and verified login-page SSR, request-specific CSP nonces on scripts, security headers, signup cookies, authenticated session/private endpoints, administrator denial, support form database persistence, cross-origin rejection, primary route responses, POST logout/revocation, and successful sign-in with session rotation.

TypeScript checking and the optimized Next.js production build passed. The Render Blueprint passed the current published JSON Schema (draft 2020-12); Render account-aware API/CLI deployment validation was not available. A production dependency audit reported zero known vulnerabilities at the time of this build. This is a package-advisory check, not a penetration test.

## Verification limits

- No live Supabase/Neon database, Render deployment, email-provider credentials or Paystack credentials were connected for this app. Production TLS, migrations, backups, actual email delivery and real/test-provider payments need deployment validation.
- PGlite validates PostgreSQL behavior, but does not test remote connection pooling, provider network rules or production throughput.
- HTTP route/SSR checks do not execute a browser. Desktop/mobile screenshots, keyboard journeys, focus behavior and full browser hydration have not been validated in this environment.
- The written design brief and authored layout guided the code. Figma’s tool quota prevented a fresh design-context read and complete visual comparison.

## Browser acceptance checklist

Run in an environment with browser access before institutional launch:

| Viewport / journey | Checks                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| 390 px phone       | Signup, mobile navigation, profile editing, mentor request, application steps and message composer        |
| 768 px tablet      | Menu overlay, filter wrapping, forms and tables without unintended page overflow                          |
| 1440 px desktop    | Sidebar, global search, dashboard, profiles, tables and messaging layout                                  |
| Keyboard           | Skip link, visible focus, modal focus trap/Escape/return focus, labels and errors                         |
| Auth               | Valid/invalid sign-in, logout, idle expiry, reset email/token and browser back navigation                 |
| Student            | Own profile/application/resume access, duplicate application, expired listing and event capacity          |
| Employer           | Verification gating, listing approval and authorized applicant resume review                              |
| Alumni             | Mentor availability, request acceptance, goals/sessions, feedback and connection consent                  |
| Administrator      | Profile verification, role/status changes, pending content, support, announcements and audit export       |
| Giving             | Configured provider sandbox success/failure/cancel/replay, amount/currency/reference mismatch and receipt |
