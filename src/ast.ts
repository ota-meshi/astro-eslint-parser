import type { TSESTree } from "@typescript-eslint/types"

export type AstroNode =
    | AstroProgram
    | AstroRootFragment
    | AstroFragment
    | AstroHTMLComment
    | AstroDoctype
    | AstroShorthandAttribute
    | AstroTemplateLiteralAttribute
    | AstroRawText

export type AstroChild =
    | TSESTree.JSXFragment["children"][number]
    | AstroHTMLComment

/** Node of Astro program root */
export interface AstroProgram extends Omit<TSESTree.Program, "type" | "body"> {
    type: "Program"
    body: (TSESTree.Program["body"][number] | AstroRootFragment)[]
    sourceType: "script" | "module"
    comments: TSESTree.Comment[]
    tokens: TSESTree.Token[]
    parent: undefined
}

/* --- Tags --- */
/** Node of Astro fragment for root (as statements) */
export interface AstroRootFragment
    extends Omit<TSESTree.BaseNode, "type" | "parent"> {
    type: "AstroRootFragment"
    children: (AstroChild | AstroDoctype)[]
    parent: AstroProgram
}
/** Node of Astro fragment expression (as expressions) */
export interface AstroFragment
    extends Omit<TSESTree.BaseNode, "type" | "parent"> {
    type: "AstroFragment"
    children: AstroChild[]
    parent: TSESTree.JSXFragment["parent"]
}
/** Node of Astro html comment */
export interface AstroHTMLComment
    extends Omit<TSESTree.BaseNode, "type" | "parent"> {
    type: "AstroHTMLComment"
    value: string
    parent:
        | AstroRootFragment
        | AstroFragment
        | TSESTree.JSXElement
        | TSESTree.JSXFragment
}
/** Node of Astro doctype */
export interface AstroDoctype
    extends Omit<TSESTree.BaseNode, "type" | "parent"> {
    type: "AstroDoctype"
    parent: AstroRootFragment | AstroFragment
}

/* --- Attributes --- */
/** Node of Astro shorthand attribute */
export interface AstroShorthandAttribute
    extends Omit<TSESTree.JSXAttribute, "type" | "parent"> {
    type: "AstroShorthandAttribute"
    value: TSESTree.JSXExpressionContainer
    parent: TSESTree.JSXElement | TSESTree.JSXFragment
}
/** Node of Astro template-literal attribute */
export interface AstroTemplateLiteralAttribute
    extends Omit<TSESTree.JSXAttribute, "type" | "parent"> {
    type: "AstroTemplateLiteralAttribute"
    value: TSESTree.JSXExpressionContainer & {
        expression: TSESTree.TemplateLiteral
    }
    parent: TSESTree.JSXElement | TSESTree.JSXFragment
}

/* --- Texts --- */
/** Node of Astro raw text */
export interface AstroRawText
    extends Omit<TSESTree.JSXText, "type" | "parent"> {
    type: "AstroRawText"
    parent: AstroRootFragment | TSESTree.JSXElement | TSESTree.JSXFragment
}
