/* eslint @eslint-community/eslint-comments/require-description: 0, @typescript-eslint/explicit-module-boundary-types: 0 */
import { getBasicParserOptions } from "../../../src/parser/test-utils";

export function getConfig() {
  return {
    parser: "astro-eslint-parser",
    parserOptions: { ...getBasicParserOptions(), parser: "espree" },
    rules: {
      "no-unused-vars": "error",
    },
    env: {
      browser: true,
      es2021: true,
    },
  };
}
