import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**", "packages/*/src/**/*.js", "packages/*/src/**/*.d.ts", "packages/*/src/**/*.js.map", "packages/*/src/**/*.d.ts.map"],
  }
);
