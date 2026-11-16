"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Brand, Button, Field, ErrorBox, Badge, Avatar } from "./ui";
export default function Auth({ mode }: { mode: "login" | "signup" | "reset" }) {
  const router = useRouter();
  const [csrf, setCsrf] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false),
    [message, setMessage] = useState(""),
    [resetToken, setResetToken] = useState("");
  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCsrf(d.csrf))
      .catch(() => setError("Unable to reach the server. Please reload."));
    setResetToken(
      new URLSearchParams(window.location.search).get("token") || "",
    );
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const fd = new FormData(event.currentTarget);
    const d: any = Object.fromEntries(fd);
    d.remember = fd.get("remember") === "on";
    if (mode === "reset" && resetToken) d.token = resetToken;
    try {
      const r = await fetch(
        "/api/auth/" +
          (mode === "reset"
            ? resetToken
              ? "reset"
              : "forgot"
            : mode === "signup"
              ? "signup"
              : "login"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify(d),
          signal: AbortSignal.timeout(20000),
        },
      );
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Please check your details.");
      if (mode === "reset") setMessage(result.message);
      else {
        router.push(mode === "signup" ? "/app/settings?onboarding=1" : "/app");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div>
          <Badge>ONE UNIVERSITY. A LIFETIME OF CONNECTIONS.</Badge>
          <h1>Your ABUAD network doesn’t end at graduation.</h1>
          <p>
            Connect with the people, opportunities and experiences that shape
            your next chapter.
          </p>
          <div className="auth-portraits">
            {[0, 1, 2, 3].map((i) => (
              <Avatar
                key={i}
                index={i}
                name="Illustrative ABUAD community member"
                size={72}
              />
            ))}
          </div>
          <div className="auth-quote">
            “A shared beginning.
            <br />
            Limitless possibilities.”
          </div>
        </div>
        <small>Afe Babalola University, Ado-Ekiti · ALUMNEX</small>
      </aside>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <Link href="/" className="back-link">
            ← Back to ALUMNEX
          </Link>
          <span className="eyebrow">ABUAD ALUMNI NETWORK</span>
          <h1>
            {mode === "signup"
              ? "Your next chapter starts here."
              : mode === "reset"
                ? "Let’s get you back in."
                : "Welcome back."}
          </h1>
          <p>
            {mode === "signup"
              ? "Create your account and connect with your ABUAD community."
              : mode === "reset"
                ? "Securely recover access to your ALUMNEX account."
                : "Sign in to your ABUAD network."}
          </p>
          {error ? <ErrorBox message={error} /> : null}
          {message ? (
            <div role="status" className="alert success">
              {message} <Link href="/login">Sign in</Link>
            </div>
          ) : null}
          <form onSubmit={submit}>
            {mode === "signup" ? (
              <>
                <Field label="Full name">
                  <input
                    name="name"
                    required
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Your full name"
                  />
                </Field>
                <Field label="How will you use ALUMNEX?">
                  <select name="role" defaultValue="student">
                    <option value="student">Student</option>
                    <option value="alumni">Alumni</option>
                    <option value="employer">Employer / Recruiter</option>
                  </select>
                </Field>
              </>
            ) : null}
            {mode !== "reset" || !resetToken ? (
              <Field label="Email address">
                <input
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>
            ) : null}
            {mode !== "reset" || resetToken ? (
              <Field
                label={mode === "reset" ? "New password" : "Password"}
                hint={
                  mode === "signup" || mode === "reset"
                    ? "Use 10–72 characters. Longer passphrases are welcome."
                    : undefined
                }
              >
                <div className="password-input">
                  <input
                    type={show ? "text" : "password"}
                    name="password"
                    required
                    minLength={mode === "login" ? 1 : 10}
                    maxLength={72}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
            ) : null}
            {mode === "login" ? (
              <div className="row between">
                <label className="checkbox">
                  <input type="checkbox" name="remember" />
                  Remember me
                </label>
                <Link href="/reset">Forgot password?</Link>
              </div>
            ) : null}
            <Button busy={busy} disabled={!csrf} className="full">
              {mode === "signup"
                ? "Create account"
                : mode === "reset"
                  ? resetToken
                    ? "Set new password"
                    : "Send reset link"
                  : "Sign In"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="auth-alternative">
            {mode === "signup"
              ? "Already part of the network?"
              : "New to ALUMNEX?"}{" "}
            <Link href={mode === "signup" ? "/login" : "/signup"}>
              {mode === "signup" ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <div className="security-note">
            <ShieldCheck size={18} />
            <span>
              Secure, private and built for your ABUAD community.{" "}
              <Link href="/security">How we protect you</Link>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
