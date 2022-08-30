import type { ParseResult } from "@astrojs/compiler";
import type { AttributeNode, Node } from "@astrojs/compiler/types";
import {
  calcAttributeEndOffset,
  calcAttributeValueStartOffset,
  getEndOffset,
  walk,
} from "../astro";
import type { NormalizedLineFeed } from "../context";
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
export function parseTemplate(code: string): TemplateResult {
  const cache = lruCache.get(code);
  if (cache) {
    return cache;
  }
  const ctx = new Context(code);
  const normalized = ctx.locs.getNormalizedLineFeed();
  const ctxForAstro = normalized.needRemap ? new Context(normalized.code) : ctx;
  try {
    const result = parseAstro(normalized?.code ?? code, ctxForAstro);

    if (normalized.needRemap) {
      remap(result, normalized, code, ctxForAstro);
      ctx.originalAST = ctxForAstro.originalAST;
    }
    const templateResult = {
      result,
      context: ctx,
    };
    lruCache.set(code, templateResult);
    return templateResult;
  } catch (e: any) {
    if (typeof e.pos === "number") {
      const err = new ParseError(e.message, normalized?.remapIndex(e.pos), ctx);
      (err as any).astroCompilerError = e;
      throw err;
    }
    throw e;
  }
}

/** Remap */
function remap(
  result: ParseResult,
  normalized: NormalizedLineFeed,
  originalCode: string,
  ctxForAstro: Context
): void {
  const remapDataMap = new Map<
    Node | AttributeNode,
    { start: number; end?: number; value?: string }
  >();

  walk(
    result.ast,
    normalized.code,
    (node) => {
      const start = normalized.remapIndex(node.position!.start.offset);
      let end: number | undefined, value: string | undefined;
      if (node.position!.end) {
        end = normalized.remapIndex(node.position!.end.offset);
        if (
          node.position!.start.offset === start &&
          node.position!.end.offset === end
        ) {
          return;
        }
      }

      if (node.type === "text") {
        value = originalCode.slice(
          start,
          normalized.remapIndex(getEndOffset(node, ctxForAstro))
        );
      } else if (node.type === "comment") {
        value = originalCode.slice(
          start + 4,
          normalized.remapIndex(getEndOffset(node, ctxForAstro)) - 3
        );
      } else if (node.type === "attribute") {
        if (
          node.kind !== "empty" &&
          node.kind !== "shorthand" &&
          node.kind !== "spread"
        ) {
          let valueStart = normalized.remapIndex(
            calcAttributeValueStartOffset(node, ctxForAstro)
          );
          let valueEnd = normalized.remapIndex(
            calcAttributeEndOffset(node, ctxForAstro)
          );
          if (
            node.kind !== "quoted" ||
            originalCode[valueStart] === '"' ||
            originalCode[valueStart] === "'"
          ) {
            valueStart++;
            valueEnd--;
          }
          value = originalCode.slice(valueStart, valueEnd);
        }
      }
      remapDataMap.set(node, {
        start,
        end,
        value,
      });
    },
    (_node) => {
      /* noop */
    }
  );

  for (const [node, remapData] of remapDataMap) {
    node.position!.start.offset = remapData.start;
    if (node.position!.end) {
      node.position!.end.offset = remapData.end!;
    }

    if (
      node.type === "text" ||
      node.type === "comment" ||
      (node.type === "attribute" &&
        node.kind !== "empty" &&
        node.kind !== "shorthand" &&
        node.kind !== "spread")
    ) {
      node.value = remapData.value!;
    }
  }
}
