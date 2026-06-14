import type {
  AttributeNode,
  JSXAttributeNode,
  JSXElementNode,
  JSXExpressionContainerNode,
  JSXFragmentNode,
  LocatedNode,
  UnknownNode,
} from "./types";
import type { TSESTree } from "@typescript-eslint/types";

/** Check whether the given node is a JSX element or fragment. */
export function isJSXElementOrFragment(
  node: UnknownNode,
): node is JSXElementNode | JSXFragmentNode {
  return node.type === "JSXElement" || node.type === "JSXFragment";
}

/**
 * Check whether a JSX fragment is only a compiler wrapper.
 *
 * e.g `<div></div><div></div>`
 *
 * In this case, the compiler wraps the two divs in a fragment,
 * but the fragment itself has no location in the source code.
 * We can identify such fragments by checking if their opening and closing tags have zero length.
 */
export function isSyntheticFragment(node: JSXFragmentNode): boolean {
  return (
    node.openingFragment.start === node.openingFragment.end &&
    (node.closingFragment == null ||
      node.closingFragment.start === node.closingFragment.end)
  );
}

/** Check whether an attribute uses Astro shorthand syntax. */
export function isShorthandAttribute(
  attr: AttributeNode,
): attr is JSXAttributeNode & {
  value: JSXExpressionContainerNode & {
    expression: TSESTree.Identifier & LocatedNode;
  };
} {
  if (
    attr.type !== "JSXAttribute" ||
    attr.name.type !== "JSXIdentifier" ||
    attr.value?.type !== "JSXExpressionContainer" ||
    !isIdentifier(attr.value.expression)
  ) {
    return false;
  }

  // In Astro's compiler AST, a shorthand attribute is represented as a JSXAttribute
  // where the value is a JSXExpressionContainer whose expression is an Identifier
  // with the same name and location as the attribute name.
  return (
    attr.value.expression.name === attr.name.name &&
    attr.value.expression.start === attr.name.start &&
    attr.value.expression.end === attr.name.end
  );
}

/** Check whether an unknown value has the node location shape. */
export function isNode(node: unknown): node is UnknownNode {
  return (
    Boolean(node) &&
    typeof node === "object" &&
    typeof (node as Partial<UnknownNode>).type === "string" &&
    typeof (node as Partial<UnknownNode>).start === "number" &&
    typeof (node as Partial<UnknownNode>).end === "number"
  );
}

/** Check whether the given node is an identifier. */
function isIdentifier(
  node: unknown,
): node is TSESTree.Identifier & LocatedNode {
  return isNode(node) && node.type === "Identifier";
}
