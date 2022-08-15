/* eslint eslint-comments/require-description: 0, @typescript-eslint/explicit-module-boundary-types: 0 */
import type { Linter } from "eslint"
import { getBasicParserOptions } from "../../../src/parser/test-utils"
// @ts-expect-error -- test
import { rules } from "eslint-plugin-simple-import-sort"
export function setupLinter(linter: Linter) {
    linter.defineRule("simple-import-sort/imports", rules.imports as never)
}

export function getConfig() {
    return {
        parser: "astro-eslint-parser",
        parserOptions: getBasicParserOptions(),
        rules: {
            "simple-import-sort/imports": "error",
        },
        env: {
            browser: true,
            es2021: true,
        },
    }
}
