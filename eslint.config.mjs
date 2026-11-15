import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "./eslint-rules/boundaries.mjs";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Omitting fields by destructuring ({ secret, ...rest }) is deliberate, not a leftover.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_" }],
    },
  },
  {
    // server/ is five domain modules behind their public entries (docs/decisions/0004)
    files: ["**/*.{ts,tsx,mjs}"],
    plugins: { sally: boundaries },
    rules: { "sally/boundaries": "error" },
  },
  globalIgnores([
    "node_modules/**", ".next/**", "out/**", "next-env.d.ts",
    // generated migrations, and the design history (static mockups, not the app)
    "drizzle/**", "design/**",
  ]),
]);
