import type { TSESTree as ES, AST_NODE_TYPES } from "@typescript-eslint/types"
import type {
    AstroFragment,
    AstroHTMLComment,
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
export type JSXParentNode = JSXElement | JSXFragment | AstroFragment
/* --- Tags --- */
export interface JSXElement extends BaseNode {
    type: AST_NODE_TYPES.JSXElement
    openingElement: JSXOpeningElement
    closingElement: JSXClosingElement | null
    children: JSXChild[]
    parent?: JSXParentNode
}
export interface JSXFragment extends BaseNode {
    type: AST_NODE_TYPES.JSXFragment
    openingFragment: JSXOpeningFragment
    closingFragment: JSXClosingFragment
    children: JSXChild[]
    parent?: JSXParentNode
}
export interface JSXOpeningElement extends BaseNode {
    type: AST_NODE_TYPES.JSXOpeningElement
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
    type: AST_NODE_TYPES.JSXClosingElement
    name: JSXTagNameExpression
    parent?: JSXElement
}
export interface JSXClosingFragment extends BaseNode {
    type: AST_NODE_TYPES.JSXClosingFragment
    parent?: JSXFragment
}
export interface JSXOpeningFragment extends BaseNode {
    type: AST_NODE_TYPES.JSXOpeningFragment
    parent?: JSXFragment
}

/* --- Attributes --- */
export interface JSXAttribute extends BaseNode {
    type: AST_NODE_TYPES.JSXAttribute
    name: JSXIdentifier | JSXNamespacedName
    value: JSXExpression | ES.Literal | null
    parent?: JSXOpeningElement
}
export interface JSXSpreadAttribute extends BaseNode {
    type: AST_NODE_TYPES.JSXSpreadAttribute
    argument: ES.Expression
    parent?: JSXOpeningElement
}

/* --- Names --- */
export type JSXTagNameExpression =
    | JSXIdentifier
    | JSXMemberExpression
    | JSXNamespacedName
export interface JSXIdentifier extends BaseNode {
    type: AST_NODE_TYPES.JSXIdentifier
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
    type: AST_NODE_TYPES.JSXMemberExpression
    object: JSXTagNameExpression
    property: JSXIdentifier
    parent?: JSXMemberExpression | JSXOpeningElement | JSXClosingElement
}
export interface JSXNamespacedName extends BaseNode {
    type: AST_NODE_TYPES.JSXNamespacedName
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
    type: AST_NODE_TYPES.JSXExpressionContainer
    expression: ES.Expression | JSXEmptyExpression
    parent?:
        | JSXAttribute
        | AstroShorthandAttribute
        | AstroTemplateLiteralAttribute
        | JSXParentNode
}
export interface JSXSpreadChild extends BaseNode {
    type: AST_NODE_TYPES.JSXSpreadChild
    expression: ES.Expression
    parent?: JSXAttribute | JSXParentNode
}
export interface JSXEmptyExpression extends BaseNode {
    type: AST_NODE_TYPES.JSXEmptyExpression
    parent?: JSXExpressionContainer
}

/* --- Texts --- */
export interface JSXText extends BaseNode {
    type: AST_NODE_TYPES.JSXText
    value: string
    raw: string
    parent?: JSXParentNode
}
