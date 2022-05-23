module.exports = {
  root: true,
  extends: [
    "plugin:@ota-meshi/recommended",
    "plugin:@ota-meshi/+node",
    "plugin:@ota-meshi/+json",
    "plugin:@ota-meshi/+prettier",
    "plugin:@ota-meshi/svelte/recommended",
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
    "node/no-missing-import": "off",
    "node/no-unpublished-require": "off",
    "node/no-unpublished-import": "off",
    "node/no-unsupported-features/es-syntax": "off",
    "require-jsdoc": "off",
    "node/file-extension-in-import": "off",
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
      // Enable this plugin
      plugins: ["astro", "react"],
      env: {
        // Enables global variables available in Astro components.
        node: true,
        "astro/astro": true,
      },
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
        "prettier/prettier": "error",
        "react/jsx-equals-spacing": "error",

        // Incompatible rules
        "react/no-unknown-property": "off",

        "require-jsdoc": "off", // ignore
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
