/* eslint @eslint-community/eslint-comments/require-description: 0, @typescript-eslint/explicit-module-boundary-types: 0 */
import { getBasicParserOptions } from "../../../src/parser/test-utils";
import * as parser from "../../../../src";
import globals from "globals";
import type { Linter } from "eslint";

export function getConfig(): Linter.Config {
  return {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser,
      parserOptions: { ...getBasicParserOptions(), parser: "espree" },
      globals: { ...globals.browser },
    },
    rules: {
      "no-unused-vars": "error",
    },
  };
}
