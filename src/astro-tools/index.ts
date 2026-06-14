import type { ParseResult } from "../parser/astro-parser/types";
import { parseTemplate as parse } from "../parser/template";

export interface ParseTemplateResult {
  result: ParseResult;
  getLocFromIndex: (index: number) => { line: number; column: number };
  getIndexFromLoc: (loc: { line: number; column: number }) => number;
}

/**
 * Parse the astro component template.
 */
export function parseTemplate(code: string): ParseTemplateResult {
  const parsed = parse(code);
  return {
    result: parsed.result,
    getLocFromIndex: (index) => parsed.context.getLocFromIndex(index),
    getIndexFromLoc: (loc) => parsed.context.locs.getIndexFromLoc(loc),
  };
}
