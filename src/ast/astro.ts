import type {
  JSXAttribute,
  JSXElement,
  JSXExpression,
  JSXExpressionContainer,
  JSXFragment,
  JSXText,
} from "./jsx";
import type { TSESTree as ES } from "@typescript-eslint/types";
import type { BaseNode } from "./base";

export type AstroNode =
  | AstroProgram
  | AstroFragment
  | AstroHTMLComment
  | AstroDoctype
  | AstroShorthandAttribute
  | AstroTemplateLiteralAttribute
  | AstroRawText;
export type AstroChild =
  | JSXElement
  | JSXFragment
  | JSXExpression
  | JSXText
  | AstroHTMLComment
  | AstroRawText;
export type AstroParentNode = JSXElement | JSXFragment | AstroFragment;

/** Node of Astro program root */
export interface AstroProgram extends Omit<ES.Program, "type" | "body"> {
  type: "Program";
  body: (ES.Program["body"][number] | AstroFragment)[];
  sourceType: "script" | "module";
  comments: ES.Comment[];
  tokens: ES.Token[];
  parent?: undefined;
}

/* --- Tags --- */
/** Node of Astro fragment */
export interface AstroFragment extends BaseNode {
  type: "AstroFragment";
  children: (AstroChild | AstroDoctype)[];
  parent?: AstroParentNode;
}
/** Node of Astro html comment */
export interface AstroHTMLComment extends BaseNode {
  type: "AstroHTMLComment";
  value: string;
  parent?: AstroParentNode;
}
/** Node of Astro doctype */
export interface AstroDoctype extends BaseNode {
  type: "AstroDoctype";
  parent?: AstroFragment;
}

/* --- Attributes --- */
/** Node of Astro shorthand attribute */
export interface AstroShorthandAttribute extends Omit<JSXAttribute, "type"> {
  type: "AstroShorthandAttribute";
  value: JSXExpressionContainer;
}
/** Node of Astro template-literal attribute */
export interface AstroTemplateLiteralAttribute
  extends Omit<JSXAttribute, "type"> {
  type: "AstroTemplateLiteralAttribute";
  value: JSXExpressionContainer & {
    expression: ES.TemplateLiteral;
  };
}

/* --- Texts --- */
/** Node of Astro raw text */
export interface AstroRawText extends Omit<JSXText, "type"> {
  type: "AstroRawText";
  parent?: JSXElement;
}
