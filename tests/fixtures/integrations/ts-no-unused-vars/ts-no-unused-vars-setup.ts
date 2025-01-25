/* eslint @eslint-community/eslint-comments/require-description: 0, @typescript-eslint/explicit-module-boundary-types: 0 */
import type { Linter } from "eslint";
import * as parser from "../../../../src";
import { getBasicParserOptions } from "../../../src/parser/test-utils";
import { rules } from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export function getConfig(): Linter.Config {
  return {
    plugins: {
      "@typescript-eslint": { rules } as any,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser,
      parserOptions: getBasicParserOptions(),
      globals: { ...globals.browser },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "no-unused-vars": "error",
    },
  };
}
