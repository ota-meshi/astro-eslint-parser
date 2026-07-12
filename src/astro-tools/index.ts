import type { ParseResult, UnknownNode } from "../astro/types";
import type { WalkContext } from "../astro/walker";
import { walk } from "../astro/walker";
import { parseTemplate as parse } from "../parser/template";

export interface ParseTemplateResult {
  result: ParseResult;
  walk: (
    parent: UnknownNode,
    enter: (n: UnknownNode, parents: UnknownNode[], ctx: WalkContext) => void,
    leave?: (n: UnknownNode, parents: UnknownNode[], ctx: WalkContext) => void,
  ) => void;
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
    walk(parent, enter, leave) {
      walk(parent, enter, leave);
    },
    getLocFromIndex: (index) => parsed.context.getLocFromIndex(index),
    getIndexFromLoc: (loc) => parsed.context.locs.getIndexFromLoc(loc),
  };
}
