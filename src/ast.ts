import type { TSESTree } from "@typescript-eslint/types"

export type AstroNode =
    | AstroProgram
    | AstroRootFragment
    | AstroHTMLComment
    | AstroDoctype

/** Node of Astro program root */
export interface AstroProgram extends Omit<TSESTree.Program, "type" | "body"> {
    type: "Program"
    body: (
        | TSESTree.Program["body"][number]
        | AstroRootFragment
        | AstroHTMLComment
    )[]
    sourceType: "script" | "module"
    comments: TSESTree.Comment[]
    tokens: TSESTree.Token[]
    parent: undefined
}

/** Node of Astro fragment root */
export interface AstroRootFragment
    extends Omit<TSESTree.BaseNode, "type" | "parent"> {
    type: "AstroRootFragment"
    children: TSESTree.JSXFragment["children"]
    parent: AstroProgram
}
/** Node of Astro html comment */
export interface AstroHTMLComment
    extends Omit<TSESTree.BaseNode, "type" | "parent"> {
    type: "AstroHTMLComment"
    value: string
    parent: AstroRootFragment | TSESTree.JSXElement | TSESTree.JSXFragment
}

/** Node of Astro doctype */
export interface AstroDoctype
    extends Omit<TSESTree.BaseNode, "type" | "parent"> {
    type: "AstroDoctype"
    parent: AstroRootFragment
}
