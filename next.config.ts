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

// /shop on Vercel (SHOP_BASE_PATH, set for Production and Preview) and in the portfolio's dev proxy:
// the portfolio serves the shop at its own /shop, so the Study can zoom into it on one origin (a view
// transition can't cross origins). Unset in CI and plain local dev, where the shop is at the root.
const base = process.env.SHOP_BASE_PATH || "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  basePath: base || undefined,
  env: { NEXT_PUBLIC_SHOP_BASE: base }, // for the few fetches that build their own URLs
  // PGlite loads its WebAssembly from beside its own files, so it runs from node_modules unbundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // the home page's model renders ask for 90 (components/front/Model.tsx); everything else keeps 75
  images: { qualities: [75, 90] },
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
  // Under a base path, the shop's old addresses still answer. Pages move for good (a reader's link
  // lands on the same page under /shop). The API is answered in place by vercel.json's rewrite (Next
  // can't rewrite outside its base path), so CI's ingest, the uptime probe and the portfolio's reads
  // keep their URLs and never have to follow a redirect.
  async redirects() {
    if (!base) return [];
    return [
      { source: "/", destination: base, permanent: true, basePath: false },
      { source: `/:path((?!${base.slice(1)}(?:/|$)|api/|_next/).*)`, destination: `${base}/:path`, permanent: true, basePath: false },
    ];
  },
};

export default nextConfig;
