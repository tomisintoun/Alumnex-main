"use client";
import { useEffect } from "react";
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="document-page">
      <h1>Let’s reconnect.</h1>
      <p>
        This page couldn’t load. Your saved records are still in your account.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
      <a className="button secondary" href="/app">
        Back to your network
      </a>
    </main>
  );
}
