import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.ALUMNEX_HTTP_TEST === "1" ? ".next-http" : ".next",
  experimental: { proxyClientMaxBodySize: "3mb" },
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};
export default config;
