/* eslint @eslint-community/eslint-comments/require-description: 0, @typescript-eslint/explicit-module-boundary-types: 0 */
import type { Linter } from "eslint";
import { getBasicParserOptions } from "../../../src/parser/test-utils";
import { rules } from "@typescript-eslint/eslint-plugin";
export function setupLinter(linter: Linter) {
  linter.defineRule(
    "@typescript-eslint/no-unsafe-assignment",
    rules["no-unsafe-assignment"] as never,
  );
}

export function getConfig() {
  return {
    parser: "astro-eslint-parser",
    parserOptions: getBasicParserOptions(),
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "error",
    },
    env: {
      browser: true,
      es2021: true,
    },
  };
}
