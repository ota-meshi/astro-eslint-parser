import { getKeys } from "../traverse";
import { isNode } from "./node";
import type {
  AstroCommentNode,
  AstroDoctypeNode,
  AstroFrontmatterNode,
  AstroRootNode,
  JSXElementNode,
  JSXFragmentNode,
  UnknownNode,
} from "./types";

export type WalkContext = {
  /** Skip walking the children of the current node. */
  skipChildren: () => void;
  /** Stop walking entirely. */
  break: () => void;
};

/**
 * Walk the compiler AST.
 * The `enter` callback is called when entering a node, and the `leave` callback is called when leaving a node.
 * The `ctx` object passed to the callbacks has two methods: `skipChildren()` to skip walking the children of the current node, and `break()` to stop walking entirely.
 * The callbacks are called in depth-first order.
 */
export function walk(
  parent: UnknownNode,
  enter: (node: UnknownNode, parents: UnknownNode[], ctx: WalkContext) => void,
  leave?: (node: UnknownNode, parents: UnknownNode[], ctx: WalkContext) => void,
): void {
  const childNodes = getChildNodes(parent);

  const parents: UnknownNode[] = [parent];
  for (const child of childNodes) {
    if (
      walkNode(
        child,
        enter,
        leave ||
          (() => {
            // noop
          }),
        parents,
      ).break
    ) {
      break;
    }
  }
}

/** Walk one compiler child node. */
function walkNode(
  node: UnknownNode,
  enter: (node: UnknownNode, parents: UnknownNode[], ctx: WalkContext) => void,
  leave: (node: UnknownNode, parents: UnknownNode[], ctx: WalkContext) => void,
  parents: UnknownNode[],
): { break?: boolean } {
  const buffer: { node: UnknownNode; parents: UnknownNode[] }[] = [
    { node, parents },
  ];

  let shouldBreak = false;
  let shouldSkipChildren = false;
  const currentCtx: WalkContext = {
    skipChildren() {
      shouldSkipChildren = true;
    },
    break() {
      shouldBreak = true;
    },
  };
  while (buffer.length > 0) {
    const current = buffer.pop()!;
    enter(current.node, current.parents, currentCtx);
    if (shouldBreak) return { break: true };
    if (shouldSkipChildren) {
      shouldSkipChildren = false;
    } else {
      const childNodes = getChildNodes(current.node);

      const parents = [current.node, ...current.parents];
      for (let i = childNodes.length - 1; i >= 0; i--) {
        buffer.push({ node: childNodes[i], parents });
      }
    }
    leave(current.node, current.parents, currentCtx);
    if (shouldBreak) return { break: true };
  }
  return {};
}

/**
 * Get child nodes of a compiler node.
 */
function getChildNodes(node: UnknownNode): UnknownNode[] {
  if (isAstroRoot(node)) {
    return [...(node.frontmatter ? [node.frontmatter] : []), ...node.body].sort(
      (a, b) => a.start - b.start,
    );
  }
  if (isAstroFrontmatter(node)) {
    return [node.program];
  }
  if (isAstroComment(node) || isAstroDoctype(node)) {
    return [];
  }
  if (isJSXFragment(node)) {
    return [
      node.openingFragment,
      ...node.children,
      ...(node.closingFragment ? [node.closingFragment] : []),
    ];
  }
  if (isJSXElement(node)) {
    return [
      node.openingElement,
      ...node.children,
      ...(node.closingElement ? [node.closingElement] : []),
    ];
  }

  const keys = getKeys(node);
  const children: UnknownNode[] = [];
  for (const key of keys) {
    const value: unknown = (node as any)[key];
    if (Array.isArray(value)) {
      for (const element of value) {
        if (isNode(element)) {
          children.push(element);
        }
      }
    } else if (isNode(value)) {
      children.push(value);
    }
  }

  return children.sort((a, b) => a.start - b.start);
}

/** Check whether the given node is a JSX element */
function isJSXElement(node: UnknownNode): node is JSXElementNode {
  return node.type === "JSXElement";
}

/** Check whether the given node is a JSX fragment */
function isJSXFragment(node: UnknownNode): node is JSXFragmentNode {
  return node.type === "JSXFragment";
}

/** Check whether the given node is the root node of the Astro AST. */
function isAstroRoot(node: UnknownNode): node is AstroRootNode {
  return node.type === "AstroRoot";
}

/** Check whether the given node is a walkable template node. */
function isAstroFrontmatter(node: UnknownNode): node is AstroFrontmatterNode {
  return node.type === "AstroFrontmatter";
}

/** Check whether the given node is a walkable template node. */
function isAstroComment(node: UnknownNode): node is AstroCommentNode {
  return node.type === "AstroComment";
}

/** Check whether the given node is a walkable template node. */
function isAstroDoctype(node: UnknownNode): node is AstroDoctypeNode {
  return node.type === "AstroDoctype";
}
