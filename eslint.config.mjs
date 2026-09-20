import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextCoreWebVitals,
  {
    ignores: [".next/**", "node_modules/**", "coverage/**"],

    rules: {
      "react/no-unescaped-entities": ["error", { forbid: [] }],
    },
  },
]);
