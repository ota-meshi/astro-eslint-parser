import type { ParseResult } from "./astro-parser/types";
import { Context } from "../context";
import { ParseError } from "../errors";
import { parse as parseAstro } from "./astro-parser/parse";
import { LruCache } from "./lru-cache";

export type TemplateResult = {
  result: ParseResult;
  context: Context;
};

const lruCache = new LruCache<string, TemplateResult>(5);

/**
 * Parse the astro component template.
 */
export function parseTemplate(code: string, filePath?: string): TemplateResult {
  const cache = lruCache.get(code);
  if (cache) {
    return cache;
  }
  const ctx = new Context(code, filePath);
  try {
    const result = parseAstro(code, ctx);

    const templateResult = {
      result,
      context: ctx,
    };
    lruCache.set(code, templateResult);
    return templateResult;
  } catch (e: any) {
    if (typeof e.pos === "number") {
      const err = new ParseError(e.message, e.pos, ctx);
      (err as any).astroCompilerError = e;
      throw err;
    }
    throw e;
  }
}
