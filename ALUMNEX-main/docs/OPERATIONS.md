# Deployment and operation

## Environment

| Variable            | Purpose                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| DATABASE_URL        | Required production PostgreSQL connection string. Keep it server-side; use TLS per provider guidance.     |
| APP_ORIGIN          | Exact public HTTPS origin in production. Required for Origin checks and recovery/checkout callback links. |
| BREVO_API_KEY       | Optional server-only recovery email API key.                                                              |
| EMAIL_FROM          | Verified email sender configured with Brevo.                                                              |
| PAYSTACK_SECRET_KEY | Optional server-only Paystack secret. Use test mode until end-to-end provider verification is complete.   |
| SEED_DEMO           | Development-only fictional examples. Keep false in production.                                            |
| SQLITE_PATH         | Development-only persistent database location. Ignored when DATABASE_URL is configured.                   |

No `NEXT_PUBLIC_*` credential variables are required. Never pass database or payment secrets into browser code. Never commit them or paste them into logs.

## PostgreSQL / Supabase

The app uses the PostgreSQL connection, not Supabase Auth or a public Supabase REST client. All exposed tables have row-level security enabled with no browser-role policies. Server authorization uses its private database connection. Use a dedicated database; schema names are not namespaced for sharing with another product. Migrations need table/trigger creation permissions. Review Supabase advisors after deployment using the connected operator account.

Schema initialization is additive and records version 1. It creates append-only audit triggers. Future incompatible schema changes require a reviewed, versioned migration and a tested backup; do not edit existing production tables ad hoc.

## Recovery email

Configure a verified `EMAIL_FROM` and a Brevo API key. A successful recovery request returns a generic response for existing and nonexistent emails. Tokens are hashed, expire after 30 minutes, and are one-time use. Password recovery revokes all sessions. Without provider configuration, recovery displays a configuration error rather than claiming an email was sent.

## Giving

Configure Paystack test credentials first. Register `https://YOUR-SITE/api/payments/webhook` as the webhook URL. The server validates the webhook HMAC and then fetches the provider’s authoritative transaction record. It verifies amount in kobo, NGN currency, reference and donor email before confirming. Duplicate notifications cannot double-count a donation.

Test successful, failed, cancelled, mismatched and repeated payments against the real provider before enabling live credentials. There is no recurring billing or refund integration. Do not solicit real donations to fictional demonstration campaigns.

## Backups and recovery

Use the database provider’s automated backups/PITR according to its plan. Also maintain encrypted off-platform backups with explicit retention. With `pg_dump` installed and `DATABASE_URL` configured:

```bash
npm run db:backup
```

The helper sends the connection string through the process environment instead of command-line arguments. Backups contain personal data and password hashes: encrypt them, restrict access, and never commit or upload them publicly.

Restore first into a fresh isolated database using `pg_restore`; validate row counts, constraints, audit immutability and a complete account/application journey before changing the production connection. Do not overwrite a working production database without an approved recovery procedure. For development SQLite, stop the app and copy the complete `.data` directory, including WAL files.

## Operational checks

- `/api/health` checks database readiness. Verify sign-in and a private data action after deployment, not only HTTP 200 on the landing page.
- Verify HTTPS redirects, the exact APP_ORIGIN, secure cookies and nonce CSP on the public domain.
- Configure monitoring for 5xx responses, failed recovery delivery, repeated lockouts and rejected payment confirmations. Logs intentionally omit raw credentials and request bodies.
- Use an operator schedule to remove expired sessions, used/expired reset tokens and expired rate-limit buckets. Audit logs remain append-only; set a retention and export policy before handling real personal data at scale.
- Review verification and content queues. Check employers before publishing opportunities and protect confidential applicant data.
- Keep Node and dependencies patched using CI and reviewed lockfile updates.
- Before a real institutional rollout, define data retention/deletion, privacy notices, incident ownership, payment authorization and university approval. This project has not been certified or penetration-tested by an external party.
