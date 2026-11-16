import Link from "next/link";
import { Brand } from "@/components/ui";
export default function Security() {
  return (
    <main className="document-page">
      <Brand />
      <Link href="/app">← Back to your network</Link>
      <span className="eyebrow">YOUR TRUST MATTERS</span>
      <h1>Security & privacy at ALUMNEX</h1>
      <p>
        These are implemented controls, not a certification or a claim that any
        system is risk-free.
      </p>
      {[
        [
          "Secure accounts",
          "Passwords are hashed with bcrypt at cost 12. We accept passphrases of at least 10 characters and never store readable passwords. Repeated sign-in attempts are rate-limited and locked out temporarily.",
        ],
        [
          "Session management",
          "Random opaque session tokens are held in HttpOnly, SameSite=Lax cookies, with Secure cookies over production HTTPS. Only token hashes are stored in the database. Sessions expire after 30 minutes of inactivity, with an absolute lifetime of 1 day or 7 days when Remember me is selected. Password changes and recovery revoke existing sessions.",
        ],
        [
          "Access control",
          "Student, alumni, employer and administrator permissions are checked on the server for every request. A role entered in a signup form cannot grant administrator rights. Applications, CVs, messages and donation history are restricted to their owners and authorized recipients.",
        ],
        [
          "Safe input and output",
          "Every mutation has server-side schema validation, parameterized SQL, CSRF tokens and same-origin checks. React escapes text. The application does not render user HTML. A nonce-based content security policy, HTTPS headers and restrictive framing policy add browser protections.",
        ],
        [
          "Private files",
          "Resumes accept PDF files up to 2 MB with a PDF signature check. Downloads require an authorized session, are served as attachments, and use sandbox and no-sniff headers. Files are not exposed at public storage URLs.",
        ],
        [
          "Messaging and visibility",
          "Members choose profile visibility and who may message them. Messaging requires an accepted connection, active mentorship or the recipient’s explicit network setting. Blocking prevents further conversation access.",
        ],
        [
          "Payments",
          "Giving uses Paystack only when configured. Card details are handled on the provider’s checkout. A payment is recorded as paid only after server-side amount, currency, reference and donor checks. Confirmation is idempotent. Recurring billing is not enabled.",
        ],
        [
          "Audit and administration",
          "Sensitive actions and denied access are audited. Database triggers prevent audit-log updates and deletions. Administrators can verify profiles, moderate content and suspend accounts; suspension revokes sessions.",
        ],
        [
          "Data and deployment",
          "Production requires PostgreSQL and an HTTPS APP_ORIGIN. Secrets belong in hosting environment variables, never in frontend code or source control. Operators must configure database backups, retention, recovery email, and payment credentials before enabling those features.",
        ],
        [
          "About this project",
          "ALUMNEX is a project prototype for Afe Babalola University, Ado-Ekiti. Example portraits and seeded records are fictional. University endorsement, production compliance and external integration availability are not implied.",
        ],
      ].map(([t, b]) => (
        <section key={t}>
          <h2>{t}</h2>
          <p>{b}</p>
        </section>
      ))}
      <Link className="button primary" href="/signup">
        Join the network
      </Link>
    </main>
  );
}
