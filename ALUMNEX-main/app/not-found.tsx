import Link from "next/link";
import { Brand } from "@/components/ui";
export default function NotFound() {
  return (
    <main className="document-page">
      <Brand />
      <h1>This connection leads somewhere else.</h1>
      <p>The page could not be found. Return to your ABUAD network.</p>
      <Link className="button primary" href="/app">
        Back to your network
      </Link>
    </main>
  );
}
