import type {
  AttributeNode,
  ParentNode,
  TagLikeNode,
  ElementNode,
  RootNode,
} from "@astrojs/compiler/types";
import type { ParseResult } from "@astrojs/compiler";
import * as service from "./astrojs-compiler-service";
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

/**
 * Parse code by `@astrojs/compiler`
 */
export function parse(code: string, ctx: Context): ParseResult {
  const ast = service.parse(code, { position: true }).ast;
  if (!ast.children) {
    // If the source code is empty, the children property may not be available.
    ast.children = [];
  }

  const htmlElement = ast.children.find(
    (n): n is ElementNode => n.type === "element" && n.name === "html"
  );
  if (htmlElement) {
    adjustHTML(ast, htmlElement, ctx);
  }
  fixLocations(ast, ctx);
  return { ast };
}

/**
 * Adjust <html> element node
 */
function adjustHTML(ast: RootNode, htmlElement: ElementNode, ctx: Context) {
  const htmlEnd = ctx.code.indexOf("</html");
  if (htmlEnd == null) {
    return;
  }
  const hasTokenAfter = Boolean(ctx.code.slice(htmlEnd + 7).trim());
  const children = [...htmlElement.children];
  for (const child of children) {
    const offset = child.position?.start.offset;
    if (hasTokenAfter && offset != null) {
      if (htmlEnd <= offset) {
        htmlElement.children.splice(htmlElement.children.indexOf(child), 1);
        ast.children.push(child);
      }
    }
    if (child.type === "element" && child.name === "body") {
      adjustHTMLBody(ast, htmlElement, htmlEnd, hasTokenAfter, child, ctx);
    }
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
  ctx: Context
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
    if (offset != null) {
      if (bodyEnd <= offset) {
        if (hasTokenAfterHtmlEnd && htmlEnd <= offset) {
          bodyElement.children.splice(bodyElement.children.indexOf(child), 1);
          ast.children.push(child);
        } else if (hasTokenAfter) {
          bodyElement.children.splice(bodyElement.children.indexOf(child), 1);
          htmlElement.children.push(child);
        }
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
            start
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
    }
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
      ctx
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
        token
      )}, actual: ${JSON.stringify(ctx.code.slice(start, start + 10))}`,
      start,
      ctx
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
  position: number
): number | null {
  const index =
    token.trim() === token ? skipSpaces(string, position) : position;
  if (string.startsWith(token, index)) {
    return index;
  }
  return null;
}
