import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "ALUMNEX · ABUAD Alumni Network",
    template: "%s · ALUMNEX",
  },
  description:
    "A lifetime of connections. The alumni, mentorship and career network for Afe Babalola University, Ado-Ekiti.",
};
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await headers();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
