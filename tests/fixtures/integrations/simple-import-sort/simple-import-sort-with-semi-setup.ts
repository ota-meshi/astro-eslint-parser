/* eslint @eslint-community/eslint-comments/require-description: 0, @typescript-eslint/explicit-module-boundary-types: 0 */
import type { Linter } from "eslint";
import * as parser from "../../../../src";
import { getBasicParserOptions } from "../../../src/parser/test-utils";
import { rules } from "eslint-plugin-simple-import-sort";
import globals from "globals";

export function getConfig(): Linter.Config {
  return {
    plugins: {
      "simple-import-sort": { rules },
    },
    languageOptions: {
      parser,
      parserOptions: getBasicParserOptions(),
      globals: { ...globals.browser },
    },
    rules: {
      "simple-import-sort/imports": "error",
    },
  };
}
