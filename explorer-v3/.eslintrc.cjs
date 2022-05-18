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
      plugins: ["react"],
      extends: [
        require.resolve("../.eslintrc.js"),
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
      ],
      globals: {
        Astro: "readonly",
      },
      parser: require.resolve(".."),
      parserOptions: {
        sourceType: "module",
        ecmaVersion: 2022,
        parser: "@typescript-eslint/parser",
      },
      rules: {
        "prettier/prettier": "off",
        "react/jsx-equals-spacing": "error",

        // Incompatible rules
        "react/no-unknown-property": "off",

        "require-jsdoc": "off", // ignore
      },
    },
  ],
};
