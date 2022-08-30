import type { ParseOptions, ParseResult } from "@astrojs/compiler";
import { createSyncFn } from "synckit";

const parseSync = createSyncFn(require.resolve("./astrojs-compiler-worker"));

/**
 * Parse code by `@astrojs/compiler`
 */
export function parse(code: string, options: ParseOptions): ParseResult {
  return parseSync(code, options);
}
