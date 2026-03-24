import type {
  AttributeNode,
  ParentNode,
  TagLikeNode,
  ElementNode,
  RootNode,
  ParseResult,
} from "./types";
// @ts-expect-error -- Type bug?
import * as service from "astrojs-compiler-sync";
import {
  calcAttributeEndOffset,
  calcCommentEndOffset,
  getSelfClosingTag,
  calcStartTagEndOffset,
  skipSpaces,
  walk,
} from "../../astro";
import type { Context } from "../../context";
import { ParseError } from "../../errors";
import { sortedLastIndex } from "../../util";

/**
 * Parse code by `@astrojs/compiler`
 */
export function parse(code: string, ctx: Context): ParseResult {
  const result = service.parse(code, { position: true });

  for (const { code, text, location, severity } of result.diagnostics || []) {
    if (severity === 1 /* Error */) {
      ctx.originalAST = result.ast;
      throw new ParseError(`${text} [${code}]`, location, ctx);
    }
  }
  if (!result.ast.children) {
    // If the source code is empty, the children property may not be available.
    result.ast.children = [];
  }

  const htmlElement = result.ast.children.find(
    (n): n is ElementNode => n.type === "element" && n.name === "html",
  );
  if (!(result as any)._adjusted) {
    if (htmlElement) {
      adjustHTML(result.ast, htmlElement, ctx);
    }
    fixLocations(result.ast, ctx);
    (result as any)._adjusted = true;
  }
  return result;
}

/**
 * Adjust <html> element node
 */
function adjustHTML(ast: RootNode, htmlElement: ElementNode, ctx: Context) {
  const htmlEnd = ctx.code.indexOf("</html");
  if (htmlEnd == null) {
    return;
  }
  // `@astrojs/compiler` may report `position.offset` as UTF-8 byte offsets.
  // By contrast, `ctx.code.indexOf()` and every offset we compute from the
  // JavaScript source string are UTF-16 code-unit offsets.
  //
  // That mismatch only matters here because `adjustHTML()` compares compiler
  // child positions against `</body>` / `</html>` offsets derived from
  // `ctx.code`. If multibyte characters appear before those nodes, comparing
  // the raw values makes nodes inside `<body>` look as if they were already
  // after `</body>` or `</html>`, which then moves them to the wrong parent.
  //
  // Keep the fix local to this adjustment logic: we only need a comparable
  // offset when deciding whether the compiler attached a node under `<body>`,
  // `<html>`, or the root by mistake.
  const isOffsetAfter = buildComparableOffsetComparator(ctx.code);
  const hasTokenAfter = Boolean(ctx.code.slice(htmlEnd + 7).trim());
  const children = [...htmlElement.children];
  for (const child of children) {
    const offset = child.position?.start.offset;
    if (hasTokenAfter && offset != null) {
      if (isOffsetAfter(offset, htmlEnd)) {
        htmlElement.children.splice(htmlElement.children.indexOf(child), 1);
        ast.children.push(child);
      }
    }
    if (child.type === "element" && child.name === "body") {
      adjustHTMLBody(
        ast,
        htmlElement,
        htmlEnd,
        hasTokenAfter,
        child,
        ctx,
        isOffsetAfter,
      );
    }
  }

  /**
   * Build a comparator used only for matching compiler offsets against
   * positions derived from `ctx.code`.
   *
   * The raw offset check is important for laziness: if the compiler offset is
   * already before the threshold, remapping cannot make it jump forward past
   * that threshold, so we can reject it without any byte/code-unit work.
   */
  function buildComparableOffsetComparator(code: string) {
    let remapOffset: ((offset: number) => number) | undefined;
    const comparableOffsetCache = new Map<number, number>();

    return (offset: number, threshold: number) => {
      if (threshold > offset) {
        return false;
      }
      let comparableOffset = comparableOffsetCache.get(offset);
      if (comparableOffset == null) {
        // Delay building the remapper until the first comparison that cannot
        // be rejected by raw offsets alone.
        remapOffset ||= buildComparableOffsetRemapper(code);
        comparableOffset = remapOffset(offset);
        comparableOffsetCache.set(offset, comparableOffset);
      }
      return threshold <= comparableOffset;
    };
  }

  /**
   * Build remapper used only for comparing compiler offsets with `ctx.code`.
   */
  function buildComparableOffsetRemapper(code: string) {
    // Fast path: ASCII text has identical byte/code-unit offsets.
    if (Buffer.byteLength(code, "utf8") === code.length) {
      return (offset: number) => offset;
    }

    const byteOffsets = [0];
    const codeUnitOffsets = [0];

    for (let index = 0, byteOffset = 0; index < code.length; ) {
      const codePoint = code.codePointAt(index)!;
      index += codePoint > 0xffff ? 2 : 1;
      byteOffset += getUTF8ByteLength(codePoint);
      byteOffsets.push(byteOffset);
      codeUnitOffsets.push(index);
    }

    return (offset: number) => {
      // Find the nearest code-unit boundary that corresponds to the compiler's
      // byte offset. We only use this for ordering comparisons, so remapping
      // the start offset to its matching string position is sufficient.
      const index =
        sortedLastIndex(byteOffsets, (target) => target - offset) - 1;
      return codeUnitOffsets[Math.max(index, 0)];
    };
  }

  /**
   * Get UTF-8 byte length for code point.
   */
  function getUTF8ByteLength(codePoint: number): number {
    if (codePoint <= 0x7f) {
      return 1;
    }
    if (codePoint <= 0x7ff) {
      return 2;
    }
    if (codePoint <= 0xffff) {
      return 3;
    }
    return 4;
  }
}

/**
 * Adjust <body> element node
 */
function adjustHTMLBody(
  ast: RootNode,
  htmlElement: ElementNode,
  htmlEnd: number,
  hasTokenAfterHtmlEnd: boolean,
  bodyElement: ElementNode,
  ctx: Context,
  isOffsetAfter: (offset: number, threshold: number) => boolean,
) {
  const bodyEnd = ctx.code.indexOf("</body");
  if (bodyEnd == null) {
    return;
  }
  const hasTokenAfter = Boolean(ctx.code.slice(bodyEnd + 7, htmlEnd).trim());
  if (!hasTokenAfter && !hasTokenAfterHtmlEnd) {
    return;
  }
  const children = [...bodyElement.children];
  for (const child of children) {
    const offset = child.position?.start.offset;
    if (offset != null && isOffsetAfter(offset, bodyEnd)) {
      if (hasTokenAfterHtmlEnd && isOffsetAfter(offset, htmlEnd)) {
        bodyElement.children.splice(bodyElement.children.indexOf(child), 1);
        ast.children.push(child);
      } else if (hasTokenAfter) {
        bodyElement.children.splice(bodyElement.children.indexOf(child), 1);
        htmlElement.children.push(child);
      }
    }
  }
}

/**
 * Fix locations
 */
function fixLocations(node: ParentNode, ctx: Context): void {
  // FIXME: Adjust because the parser does not return the correct location.
  let start = 0;
  walk(
    node,
    ctx.code,
    // eslint-disable-next-line complexity -- X(
    (node, [parent]) => {
      if (node.type === "frontmatter") {
        start = node.position!.start.offset = tokenIndex(ctx, "---", start);
        if (!node.position!.end) {
          node.position!.end = {} as any;
        }
        start = node.position!.end!.offset =
          tokenIndex(ctx, "---", start + 3 + node.value.length) + 3;
      } else if (
        node.type === "fragment" ||
        node.type === "element" ||
        node.type === "component" ||
        node.type === "custom-element"
      ) {
        if (!node.position) {
          node.position = { start: {}, end: {} } as any;
        }
        start = node.position!.start.offset = tokenIndex(ctx, "<", start);
        start += 1;
        start += node.name.length;
        if (!node.attributes.length) {
          start = calcStartTagEndOffset(node, ctx);
        }
      } else if (node.type === "attribute") {
        fixLocationForAttr(node, ctx, start);
        start = calcAttributeEndOffset(node, ctx);
        if (node.position!.end) {
          node.position!.end.offset = start;
        }
      } else if (node.type === "comment") {
        node.position!.start.offset = tokenIndex(ctx, "<!--", start);
        start = calcCommentEndOffset(node, ctx);
        if (node.position!.end) {
          node.position!.end.offset = start;
        }
      } else if (node.type === "text") {
        if (
          parent.type === "element" &&
          (parent.name === "script" || parent.name === "style")
        ) {
          node.position!.start.offset = start;
          start = ctx.code.indexOf(`</${parent.name}`, start);
          if (start < 0) {
            start = ctx.code.length;
          }
        } else {
          const index = tokenIndexSafe(ctx.code, node.value, start);
          if (index != null) {
            start = node.position!.start.offset = index;
            start += node.value.length;
          } else {
            // FIXME: Some white space may be removed.
            node.position!.start.offset = start;
            const value = node.value.replace(/\s+/gu, "");
            for (const char of value) {
              const index = tokenIndex(ctx, char, start);
              start = index + 1;
            }
            start = skipSpaces(ctx.code, start);

            node.value = ctx.code.slice(node.position!.start.offset, start);
          }
        }
        if (node.position!.end) {
          node.position!.end.offset = start;
        }
      } else if (node.type === "expression") {
        start = node.position!.start.offset = tokenIndex(ctx, "{", start);
        start += 1;
      } else if (node.type === "doctype") {
        if (!node.position) {
          node.position = { start: {}, end: {} } as any;
        }
        if (!node.position!.end) {
          node.position!.end = {} as any;
        }
        start = node.position!.start.offset = tokenIndex(ctx, "<!", start);
        start += 2;
        start = node.position!.end!.offset = ctx.code.indexOf(">", start) + 1;
      } else if (node.type === "root") {
        // noop
      }
    },
    (node, [parent]) => {
      if (node.type === "attribute") {
        const attributes = (parent as TagLikeNode).attributes;
        if (attributes[attributes.length - 1] === node) {
          start = calcStartTagEndOffset(parent as TagLikeNode, ctx);
        }
      } else if (node.type === "expression") {
        start = tokenIndex(ctx, "}", start) + 1;
      } else if (
        node.type === "fragment" ||
        node.type === "element" ||
        node.type === "component" ||
        node.type === "custom-element"
      ) {
        if (!getSelfClosingTag(node, ctx)) {
          const closeTagStart = tokenIndexSafe(
            ctx.code,
            `</${node.name}`,
            start,
          );
          if (closeTagStart != null) {
            start = closeTagStart + 2 + node.name.length;
            start = tokenIndex(ctx, ">", start) + 1;
          }
        }
      } else {
        return;
      }
      if (node.position!.end) {
        node.position!.end.offset = start;
      }
    },
  );
}

/**
 * Fix locations
 */
function fixLocationForAttr(node: AttributeNode, ctx: Context, start: number) {
  if (node.kind === "empty") {
    node.position!.start.offset = tokenIndex(ctx, node.name, start);
  } else if (node.kind === "quoted") {
    node.position!.start.offset = tokenIndex(ctx, node.name, start);
  } else if (node.kind === "expression") {
    node.position!.start.offset = tokenIndex(ctx, node.name, start);
  } else if (node.kind === "shorthand") {
    node.position!.start.offset = tokenIndex(ctx, "{", start);
  } else if (node.kind === "spread") {
    node.position!.start.offset = tokenIndex(ctx, "{", start);
  } else if (node.kind === "template-literal") {
    node.position!.start.offset = tokenIndex(ctx, node.name, start);
  } else {
    throw new ParseError(
      `Unknown attr kind: ${node.kind}`,
      node.position!.start.offset,
      ctx,
    );
  }
}

/**
 * Get token index
 */
function tokenIndex(ctx: Context, token: string, position: number): number {
  const index = tokenIndexSafe(ctx.code, token, position);
  if (index == null) {
    const start =
      token.trim() === token ? skipSpaces(ctx.code, position) : position;
    throw new ParseError(
      `Unknown token at ${start}, expected: ${JSON.stringify(
        token,
      )}, actual: ${JSON.stringify(ctx.code.slice(start, start + 10))}`,
      start,
      ctx,
    );
  }
  return index;
}

/**
 * Get token index
 */
function tokenIndexSafe(
  string: string,
  token: string,
  position: number,
): number | null {
  const index =
    token.trim() === token ? skipSpaces(string, position) : position;
  if (string.startsWith(token, index)) {
    return index;
  }
  return null;
}
