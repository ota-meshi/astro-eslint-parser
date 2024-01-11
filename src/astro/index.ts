import type {
  AttributeNode,
  CommentNode,
  DoctypeNode,
  ExpressionNode,
  Node,
  ParentNode,
  TagLikeNode,
} from "@astrojs/compiler/types";
import {
  EntityDecoder,
  DecodingMode,
  htmlDecodeTree,
} from "entities/lib/decode.js";
import type { Context } from "../context";
import { ParseError } from "../errors";

/**
 * Checks if the given node is TagLikeNode
 */
export function isTag(node: Node): node is Node & TagLikeNode {
  return (
    node.type === "element" ||
    node.type === "custom-element" ||
    node.type === "component" ||
    node.type === "fragment"
  );
}

/**
 * Checks if the given node is ParentNode
 */
export function isParent(node: Node): node is ParentNode {
  return Array.isArray((node as any).children);
}

/** walk element nodes */
export function walkElements(
  parent: ParentNode,
  code: string,
  enter: (n: Node, parents: ParentNode[]) => void,
  leave: (n: Node, parents: ParentNode[]) => void,
  parents: ParentNode[] = [],
): void {
  const children = getSortedChildren(parent, code);
  const currParents = [parent, ...parents];
  for (const node of children) {
    enter(node, currParents);
    if (isParent(node)) {
      walkElements(node, code, enter, leave, currParents);
    }
    leave(node, currParents);
  }
}

/** walk nodes */
export function walk(
  parent: ParentNode,
  code: string,
  enter: (n: Node | AttributeNode, parents: ParentNode[]) => void,
  leave: (n: Node | AttributeNode, parents: ParentNode[]) => void,
): void {
  walkElements(
    parent,
    code,
    (node, parents) => {
      enter(node, parents);
      if (isTag(node)) {
        const attrParents = [node, ...parents];
        for (const attr of node.attributes) {
          enter(attr, attrParents);
          leave(attr, attrParents);
        }
      }
    },
    leave,
  );
}

/**
 * Get end offset of start tag
 */
export function calcStartTagEndOffset(node: TagLikeNode, ctx: Context): number {
  const lastAttr = node.attributes[node.attributes.length - 1];
  let beforeCloseIndex: number;
  if (lastAttr) {
    beforeCloseIndex = calcAttributeEndOffset(lastAttr, ctx);
  } else {
    const info = getTokenInfo(
      ctx,
      [`<${node.name}`],
      node.position!.start.offset,
    );
    beforeCloseIndex = info.index + info.match.length;
  }
  const info = getTokenInfo(ctx, [[">", "/>"]], beforeCloseIndex);
  return info.index + info.match.length;
}

/**
 * Get end offset of attribute
 */
export function calcAttributeEndOffset(
  node: AttributeNode,
  ctx: Context,
): number {
  let info;
  if (node.kind === "empty") {
    info = getTokenInfo(ctx, [node.name], node.position!.start.offset);
  } else if (node.kind === "quoted") {
    info = getTokenInfo(
      ctx,
      [
        [
          {
            token: `"${node.value}"`,
            htmlEntityDecode: true,
          },
          {
            token: `'${node.value}'`,
            htmlEntityDecode: true,
          },
          {
            token: node.value,
            htmlEntityDecode: true,
          },
        ],
      ],
      calcAttributeValueStartOffset(node, ctx),
    );
  } else if (node.kind === "expression") {
    info = getTokenInfo(
      ctx,
      ["{", node.value, "}"],
      calcAttributeValueStartOffset(node, ctx),
    );
  } else if (node.kind === "shorthand") {
    info = getTokenInfo(
      ctx,
      ["{", node.name, "}"],
      node.position!.start.offset,
    );
  } else if (node.kind === "spread") {
    info = getTokenInfo(
      ctx,
      ["{", "...", node.name, "}"],
      node.position!.start.offset,
    );
  } else if (node.kind === "template-literal") {
    info = getTokenInfo(
      ctx,
      [`\`${node.value}\``],
      calcAttributeValueStartOffset(node, ctx),
    );
  } else {
    throw new ParseError(
      `Unknown attr kind: ${node.kind}`,
      node.position!.start.offset,
      ctx,
    );
  }
  return info.index + info.match.length;
}

/**
 * Get start offset of attribute value
 */
export function calcAttributeValueStartOffset(
  node: AttributeNode,
  ctx: Context,
): number {
  let info;
  if (node.kind === "quoted") {
    info = getTokenInfo(
      ctx,
      [
        node.name,
        "=",
        [`"`, `'`, { token: node.value, htmlEntityDecode: true }],
      ],
      node.position!.start.offset,
    );
  } else if (node.kind === "expression") {
    info = getTokenInfo(
      ctx,
      [node.name, "=", "{"],
      node.position!.start.offset,
    );
  } else if (node.kind === "template-literal") {
    info = getTokenInfo(
      ctx,
      [node.name, "=", "`"],
      node.position!.start.offset,
    );
  } else {
    throw new ParseError(
      `Unknown attr kind: ${node.kind}`,
      node.position!.start.offset,
      ctx,
    );
  }
  return info.index;
}

/**
 * Get end offset of tag
 */
export function getEndOffset(node: Node, ctx: Context): number {
  if (node.position!.end?.offset != null) {
    return node.position!.end.offset;
  }
  if (isTag(node)) return calcTagEndOffset(node, ctx);
  if (node.type === "expression") return calcExpressionEndOffset(node, ctx);
  if (node.type === "comment") return calcCommentEndOffset(node, ctx);
  if (node.type === "frontmatter") {
    const start = node.position!.start.offset;
    return ctx.code.indexOf("---", start + 3) + 3;
  }
  if (node.type === "doctype") {
    const start = node.position!.start.offset;
    return ctx.code.indexOf(">", start) + 1;
  }
  if (node.type === "text") {
    const start = node.position!.start.offset;
    return start + node.value.length;
  }
  if (node.type === "root") {
    return ctx.code.length;
  }

  throw new Error(`unknown type: ${(node as any).type}`);
}

/**
 * Get content end offset
 */
export function calcContentEndOffset(parent: ParentNode, ctx: Context): number {
  const code = ctx.code;
  if (isTag(parent)) {
    const end = getEndOffset(parent, ctx);
    if (code[end - 1] !== ">") {
      return end;
    }
    const index = code.lastIndexOf("</", end - 1);
    if (index >= 0 && code.slice(index + 2, end - 1).trim() === parent.name) {
      return index;
    }
    return end;
  } else if (parent.type === "expression") {
    const end = getEndOffset(parent, ctx);
    return code.lastIndexOf("}", end);
  } else if (parent.type === "root") {
    return code.length;
  }
  throw new Error(`unknown type: ${(parent as any).type}`);
}

/**
 * If the given tag is a self-close tag, get the self-closing tag.
 */
export function getSelfClosingTag(
  node: TagLikeNode,
  ctx: Context,
): null | {
  offset: number;
  end: "/>" | ">";
} {
  if (node.children.length > 0) {
    return null;
  }
  const code = ctx.code;
  const startTagEndOffset = calcStartTagEndOffset(node, ctx);
  if (code.startsWith("/>", startTagEndOffset - 2)) {
    return {
      offset: startTagEndOffset,
      end: "/>",
    };
  }
  if (code.startsWith(`</${node.name}`, startTagEndOffset)) {
    return null;
  }
  return {
    offset: startTagEndOffset,
    end: ">",
  };
}
/**
 * If the given tag has a end tag, get the end tag.
 */
export function getEndTag(
  node: TagLikeNode,
  ctx: Context,
): null | {
  offset: number;
  tag: string;
} {
  let beforeIndex: number;
  if (node.children.length) {
    const lastChild = node.children[node.children.length - 1];
    beforeIndex = getEndOffset(lastChild, ctx);
  } else {
    beforeIndex = calcStartTagEndOffset(node, ctx);
  }
  beforeIndex = skipSpaces(ctx.code, beforeIndex);

  if (ctx.code.startsWith(`</${node.name}`, beforeIndex)) {
    const offset = beforeIndex;
    beforeIndex = beforeIndex + 2 + node.name.length;
    const info = getTokenInfo(ctx, [">"], beforeIndex);
    const end = info.index + info.match.length;
    return {
      offset,
      tag: ctx.code.slice(offset, end),
    };
  }
  return null;
}

/**
 * Get end offset of comment
 */
export function calcCommentEndOffset(node: CommentNode, ctx: Context): number {
  const info = getTokenInfo(
    ctx,
    ["<!--", node.value, "-->"],
    node.position!.start.offset,
  );

  return info.index + info.match.length;
}

/**
 * Get end offset of tag
 */
function calcTagEndOffset(node: TagLikeNode, ctx: Context): number {
  let beforeIndex: number;
  if (node.children.length) {
    const lastChild = node.children[node.children.length - 1];
    beforeIndex = getEndOffset(lastChild, ctx);
  } else {
    beforeIndex = calcStartTagEndOffset(node, ctx);
  }
  beforeIndex = skipSpaces(ctx.code, beforeIndex);

  if (ctx.code.startsWith(`</${node.name}`, beforeIndex)) {
    beforeIndex = beforeIndex + 2 + node.name.length;
    const info = getTokenInfo(ctx, [">"], beforeIndex);
    return info.index + info.match.length;
  }
  return beforeIndex;
}

/**
 * Get end offset of Expression
 */
function calcExpressionEndOffset(node: ExpressionNode, ctx: Context): number {
  if (node.children.length) {
    const lastChild = node.children[node.children.length - 1];
    const beforeIndex = getEndOffset(lastChild, ctx);
    const info = getTokenInfo(ctx, ["}"], beforeIndex);
    return info.index + info.match.length;
  }
  const info = getTokenInfo(ctx, ["{", "}"], node.position!.start.offset);
  return info.index + info.match.length;
}

type TokenParam = { token: string; htmlEntityDecode: boolean };

/**
 * Get token info
 */
function getTokenInfo(
  ctx: Context,
  tokens: (TokenParam | string | (TokenParam | string)[])[],
  position: number,
): {
  match: string;
  index: number;
} {
  let lastMatch:
    | {
        match: string;
        index: number;
      }
    | undefined;
  for (const t of tokens) {
    const index = lastMatch
      ? lastMatch.index + lastMatch.match.length
      : position;
    const m = Array.isArray(t) ? matchOfForMulti(t, index) : match(t, index);
    if (m == null) {
      throw new ParseError(
        `Unknown token at ${index}, expected: ${JSON.stringify(
          t,
        )}, actual: ${JSON.stringify(ctx.code.slice(index, index + 10))}`,
        index,
        ctx,
      );
    }
    lastMatch = m;
  }
  return lastMatch!;

  /**
   * For Single Token
   */
  function match(token: TokenParam | string, position: number) {
    const search = typeof token === "string" ? token : token.token;
    const index =
      search.trim() === search ? skipSpaces(ctx.code, position) : position;
    if (ctx.code.startsWith(search, index)) {
      return {
        match: search,
        index,
      };
    }
    if (typeof token !== "string") {
      return matchWithHTMLEntity(token, index);
    }
    return null;
  }

  /**
   * For Multiple Token
   */
  function matchOfForMulti(search: (TokenParam | string)[], position: number) {
    for (const s of search) {
      const m = match(s, position);
      if (m) {
        return m;
      }
    }
    return null;
  }

  /**
   * With HTML entity
   */
  function matchWithHTMLEntity(token: TokenParam, position: number) {
    const search = token.token;
    let codeOffset = position;
    let searchOffset = 0;
    while (searchOffset < search.length) {
      const searchChar = search[searchOffset];
      if (ctx.code[codeOffset] === searchChar) {
        codeOffset++;
        searchOffset++;
        continue;
      }
      const entity = getHTMLEntity(codeOffset);
      if (entity?.entity === searchChar) {
        codeOffset += entity.length;
        searchOffset++;
        continue;
      }
      return null;
    }
    return {
      match: ctx.code.slice(position, codeOffset),
      index: position,
    };

    /**
     * Get HTML entity from the given position
     */
    function getHTMLEntity(position: number) {
      let codeOffset = position;
      if (ctx.code[codeOffset++] !== "&") return null;

      let entity = "";
      const entityDecoder = new EntityDecoder(
        htmlDecodeTree,
        (cp) => (entity += String.fromCodePoint(cp)),
      );
      entityDecoder.startEntity(DecodingMode.Attribute);
      const length = entityDecoder.write(ctx.code, codeOffset);

      if (length < 0) {
        return null;
      }
      if (length === 0) {
        return null;
      }
      return {
        entity,
        length,
      };
    }
  }
}

/**
 * Skip spaces
 */
export function skipSpaces(string: string, position: number): number {
  const re = /\s*/g;
  re.lastIndex = position;
  const match = re.exec(string);
  if (match) {
    return match.index + match[0].length;
  }
  return position;
}

/**
 * Get children
 */
function getSortedChildren(parent: ParentNode, code: string) {
  if (parent.type === "root" && parent.children[0]?.type === "frontmatter") {
    // The order of comments and frontmatter may be changed.
    const children = [...parent.children];
    if (children.every((n) => n.position)) {
      return children.sort(
        (a, b) => a.position!.start.offset - b.position!.start.offset,
      );
    }
    let start = skipSpaces(code, 0);
    if (code.startsWith("<!", start)) {
      const frontmatter = children.shift()!;
      const before: (CommentNode | DoctypeNode)[] = [];
      let first;
      while ((first = children.shift())) {
        start = skipSpaces(code, start);
        if (first.type === "comment" && code.startsWith("<!--", start)) {
          start = code.indexOf("-->", start + 4) + 3;
          before.push(first);
        } else if (first.type === "doctype" && code.startsWith("<!", start)) {
          start = code.indexOf(">", start + 2) + 1;
          before.push(first);
        } else {
          children.unshift(first);
          break;
        }
      }
      return [...before, frontmatter, ...children];
    }
  }
  return parent.children;
}
