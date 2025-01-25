import tsParser from "@typescript-eslint/parser";
import astro from "eslint-plugin-astro";
import svelte from "eslint-plugin-svelte";
import astroParser from "astro-eslint-parser";
import globals from "globals";
import myPlugin from "@ota-meshi/eslint-plugin";

export default [
  {
    ignores: [
      ".nyc_output",
      "coverage",
      "lib",
      "node_modules",
      "tests/fixtures/**/*.json",
      "tests/fixtures/**/*.astro",
      "explorer-v3/dist",
      "explorer-v3/build",
      "explorer-v3/build-system/shim/astro-eslint-parser/*.*",
      "explorer-v3/build-system/shim/escape-string-regexp/*.*",
      "explorer-v3/build-system/shim/eslint-scope/*.*",
      "explorer-v3/build-system/shim/eslint/*.*",
      "explorer-v3/src/env.d.ts",
      "explorer-v3/.astro/",
    ],
  },
  ...myPlugin.config({
    node: true,
    ts: true,
    prettier: true,
    packageJson: true,
    json: true,
  }),
  {
    languageOptions: {
      sourceType: "script",
    },

    rules: {
      "jsdoc/require-jsdoc": "error",
      "no-warning-comments": "warn",
      "no-lonely-if": "off",
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": "off",
    },
  },
  {
    files: ["*.mjs", "**/*.mjs"],
    languageOptions: {
      sourceType: "module",
    },
  },
  {
    files: ["**/*.ts"],

    languageOptions: {
      parser: tsParser,
      sourceType: "module",

      parserOptions: {
        project: "./tsconfig.json",
      },
    },

    rules: {
      "no-void": [
        "error",
        {
          allowAsStatement: true,
        },
      ],

      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "property",
          format: null,
        },
        {
          selector: "method",
          format: null,
        },
        {
          selector: "import",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
        },
      ],

      "no-implicit-globals": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["scripts/**/*.ts", "tests/**/*.ts"],

    rules: {
      "jsdoc/require-jsdoc": "off",
      "no-console": "off",
    },
  },
  {
    files: ["explorer-v3/**/*.{js,mjs,cjs,svelte,astro}"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      "jsdoc/require-jsdoc": "off",
      "n/file-extension-in-import": "off",
      "n/no-extraneous-import": "off",
      "n/no-missing-import": "off",
      "n/no-missing-require": "off",
    },
  },
  ...astro.configs["flat/all"].map((config) => ({
    ...config,
    files: ["explorer-v3/**/*.astro"],
  })),
  ...svelte.configs["flat/recommended"].map((config) => ({
    ...config,
    files: ["explorer-v3/**/*.svelte"],
  })),
  {
    files: ["explorer-v3/**/*.astro"],
    languageOptions: {
      parser: astroParser,
    },
  },
  {
    files: ["benchmark/**/*.ts"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "no-console": "off",
    },
  },
];
