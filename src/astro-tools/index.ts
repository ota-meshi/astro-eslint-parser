import type { ParseResult } from "@astrojs/compiler";
import { parseTemplate as parse } from "../parser/template";
import {
  getEndOffset,
  walk,
  calcAttributeValueStartOffset,
  calcAttributeEndOffset,
} from "../astro";
import type { AttributeNode, Node, ParentNode } from "@astrojs/compiler/types";

export interface ParseTemplateResult {
  result: ParseResult;
  getEndOffset: (node: Node) => number;
  calcAttributeValueStartOffset: (node: AttributeNode) => number;
  calcAttributeEndOffset: (node: AttributeNode) => number;
  walk: (
    parent: ParentNode,
    enter: (n: Node | AttributeNode, parents: ParentNode[]) => void,
    leave?: (n: Node | AttributeNode, parents: ParentNode[]) => void,
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
    getEndOffset: (node) => getEndOffset(node, parsed.context),
    calcAttributeValueStartOffset: (node) =>
      calcAttributeValueStartOffset(node, parsed.context),
    calcAttributeEndOffset: (node) =>
      calcAttributeEndOffset(node, parsed.context),
    walk(parent, enter, leave) {
      walk(
        parent,
        code,
        enter,
        leave ||
          (() => {
            /* noop */
          }),
      );
    },
    getLocFromIndex: (index) => parsed.context.getLocFromIndex(index),
    getIndexFromLoc: (loc) => parsed.context.locs.getIndexFromLoc(loc),
  };
}
