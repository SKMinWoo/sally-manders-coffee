import type { NextConfig } from "next";

// Headers every response carries. The CSP allows inline styles because next/font and React's
// style props emit them; scripts stay limited to this origin plus the inline bootstraps Next
// needs. The full DevSecOps pipeline (CodeQL, Dependabot, SonarCloud) is its own exhibit.
const dev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// Unset everywhere but one dev setup: the portfolio's dev server proxies the shop at /shop, so the
// Study can zoom into it on one origin (a view transition can't cross origins).
const base = process.env.SHOP_BASE_PATH || "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  basePath: base || undefined,
  env: { NEXT_PUBLIC_SHOP_BASE: base }, // for the few fetches that build their own URLs
  // PGlite loads its WebAssembly from beside its own files, so it runs from node_modules unbundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
