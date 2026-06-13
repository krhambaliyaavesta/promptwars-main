// ESLint flat config for the TypeScript backend.
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    // Ignore build output, dependencies, the vanilla browser script
    // (no build step, browser globals), and Node config files.
    ignores: [
      "dist/",
      "node_modules/",
      "src/public/",
      "*.config.js",
      "jest.config.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "no-console": "off",
    },
  },
);
