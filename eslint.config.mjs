import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Omitting fields by destructuring ({ secret, ...rest }) is deliberate, not a leftover.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([
    "node_modules/**", ".next/**", "out/**", "next-env.d.ts",
    // generated migrations, and the design history (static mockups, not the app)
    "drizzle/**", "design/**",
  ]),
]);
