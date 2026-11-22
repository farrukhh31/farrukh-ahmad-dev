import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // After Effects ExtendScript (ES3) and Python helpers - not part of the web app
    "video/**",
    "avatar/**",
    "backend/**",
  ]),
  {
    // The original (pre-game) recruiter-mode components predate React 19's strict
    // compiler rules. They work and are covered by the build, so these two rules are
    // reported as warnings instead of failing CI. Everything in hooks/, lib/ and the
    // game code is clean.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
