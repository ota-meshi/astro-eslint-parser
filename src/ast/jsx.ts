import type { TSESTree as ES } from "@typescript-eslint/types"
import type {
    AstroFragment,
    AstroHTMLComment,
    AstroRawText,
    AstroShorthandAttribute,
    AstroTemplateLiteralAttribute,
} from "./astro"
import type { BaseNode } from "./base"

export type JSXNode =
    | JSXAttribute
    | JSXClosingElement
    | JSXClosingFragment
    | JSXElement
    | JSXEmptyExpression
    | JSXExpressionContainer
    | JSXFragment
    | JSXIdentifier
    | JSXMemberExpression
    | JSXNamespacedName
    | JSXOpeningElement
    | JSXOpeningFragment
    | JSXSpreadAttribute
    | JSXSpreadChild
    | JSXText
export type JSXChild =
    | JSXElement
    | JSXFragment
    | JSXExpression
    | JSXText
    | AstroHTMLComment
    | AstroRawText
export type JSXParentNode = JSXElement | JSXFragment | AstroFragment
/* --- Tags --- */
export interface JSXElement extends BaseNode {
    type: "JSXElement"
    openingElement: JSXOpeningElement
    closingElement: JSXClosingElement | null
    children: JSXChild[]
    parent?: JSXParentNode
}
export interface JSXFragment extends BaseNode {
    type: "JSXFragment"
    openingFragment: JSXOpeningFragment
    closingFragment: JSXClosingFragment
    children: JSXChild[]
    parent?: JSXParentNode
}
export interface JSXOpeningElement extends BaseNode {
    type: "JSXOpeningElement"
    typeParameters?: ES.TSTypeParameterInstantiation
    selfClosing: boolean
    name: JSXTagNameExpression
    attributes: (
        | JSXAttribute
        | JSXSpreadAttribute
        | AstroShorthandAttribute
        | AstroTemplateLiteralAttribute
    )[]
    parent?: JSXElement
}
export interface JSXClosingElement extends BaseNode {
    type: "JSXClosingElement"
    name: JSXTagNameExpression
    parent?: JSXElement
}
export interface JSXClosingFragment extends BaseNode {
    type: "JSXClosingFragment"
    parent?: JSXFragment
}
export interface JSXOpeningFragment extends BaseNode {
    type: "JSXOpeningFragment"
    parent?: JSXFragment
}

/* --- Attributes --- */
export interface JSXAttribute extends BaseNode {
    type: "JSXAttribute"
    name: JSXIdentifier | JSXNamespacedName
    value: JSXExpression | ES.Literal | null
    parent?: JSXOpeningElement
}
export interface JSXSpreadAttribute extends BaseNode {
    type: "JSXSpreadAttribute"
    argument: ES.Expression
    parent?: JSXOpeningElement
}

/* --- Names --- */
export type JSXTagNameExpression =
    | JSXIdentifier
    | JSXMemberExpression
    | JSXNamespacedName
export interface JSXIdentifier extends BaseNode {
    type: "JSXIdentifier"
    name: string
    parent?:
        | JSXAttribute
        | AstroShorthandAttribute
        | AstroTemplateLiteralAttribute
        | JSXMemberExpression
        | JSXNamespacedName
        | JSXOpeningElement
        | JSXClosingElement
}
export interface JSXMemberExpression extends BaseNode {
    type: "JSXMemberExpression"
    object: JSXTagNameExpression
    property: JSXIdentifier
    parent?: JSXMemberExpression | JSXOpeningElement | JSXClosingElement
}
export interface JSXNamespacedName extends BaseNode {
    type: "JSXNamespacedName"
    namespace: JSXIdentifier
    name: JSXIdentifier
    parent?:
        | JSXAttribute
        | AstroShorthandAttribute
        | AstroTemplateLiteralAttribute
        | JSXMemberExpression
        | JSXOpeningElement
        | JSXClosingElement
}

/* --- Expressions --- */
export type JSXExpression = JSXExpressionContainer | JSXSpreadChild
export interface JSXExpressionContainer extends BaseNode {
    type: "JSXExpressionContainer"
    expression: ES.Expression | JSXEmptyExpression
    parent?:
        | JSXAttribute
        | AstroShorthandAttribute
        | AstroTemplateLiteralAttribute
        | JSXParentNode
}
export interface JSXSpreadChild extends BaseNode {
    type: "JSXSpreadChild"
    expression: ES.Expression
    parent?: JSXAttribute | JSXParentNode
}
export interface JSXEmptyExpression extends BaseNode {
    type: "JSXEmptyExpression"
    parent?: JSXExpressionContainer
}

/* --- Texts --- */
export interface JSXText extends BaseNode {
    type: "JSXText"
    value: string
    raw: string
    parent?: JSXParentNode
}
