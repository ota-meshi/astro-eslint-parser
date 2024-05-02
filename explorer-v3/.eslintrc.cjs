module.exports = {
  root: true,
  extends: [
    "plugin:@ota-meshi/recommended",
    "plugin:@ota-meshi/+node",
    "plugin:@ota-meshi/+json",
    "plugin:@ota-meshi/+prettier",
    "plugin:svelte/recommended",
    "plugin:astro/all",
  ],
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2022,
  },
  env: {
    browser: true,
    es2017: true,
    node: true,
  },
  globals: {
    globalThis: "readonly",
  },
  rules: {
    "eslint-comments/no-unused-disable": "off",
    "n/no-missing-import": "off",
    "n/no-unpublished-require": "off",
    "n/no-unpublished-import": "off",
    "n/no-unsupported-features/es-syntax": "off",
    "n/no-unsupported-features/es-builtins": "off",
    "require-jsdoc": "off",
    "n/file-extension-in-import": "off",
    "prettier/prettier": [
      "error",
      {},
      {
        usePrettierrc: true,
      },
    ],
    "no-shadow": "off",
    camelcase: "off",
    "no-process-env": "off",
  },
  overrides: [
    {
      files: ["*.d.ts"],
      rules: {
        "spaced-comment": "off",
      },
    },
    {
      files: ["*.astro"],
      plugins: ["react"],
      extends: [
        require.resolve("../.eslintrc.js"),
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
      ],
      parser: "astro-eslint-parser",
      parserOptions: {
        sourceType: "module",
        ecmaVersion: 2022,
        parser: "@typescript-eslint/parser",
      },
      rules: {
        "astro/prefer-split-class-list": [
          "error",
          {
            splitLiteral: true,
          },
        ],
        "prettier/prettier": "error",
        "react/jsx-equals-spacing": "error",

        // Incompatible rules
        "react/no-unknown-property": "off",

        "require-jsdoc": "off", // ignore
      },
      settings: {
        react: {
          version: "16.3",
        },
      },
    },
    {
      // Define the configuration for `<script>` tag.
      // Script in `<script>` is assigned a virtual file name with the `.js` extension.
      files: ["**/*.astro/*.js", "*.astro/*.js"],
      env: {
        browser: true,
      },
    },
  ],
};
