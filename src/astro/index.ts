import type {
    AttributeNode,
    Node,
    ParentNode,
    TagLikeNode,
} from "@astrojs/compiler/types"

/**
 * Checks if the given node is TagLikeNode
 */
export function isTag(node: Node): node is Node & TagLikeNode {
    return (
        node.type === "element" ||
        node.type === "custom-element" ||
        node.type === "component" ||
        node.type === "fragment"
    )
}

/**
 * Checks if the given node is ParentNode
 */
export function isParent(node: Node): node is ParentNode {
    return Array.isArray((node as any).children)
}

/** walk element nodes */
export function walkElements(
    parent: ParentNode,
    cb: (n: Node, parent: ParentNode) => void,
): void {
    let children = parent.children
    if (parent.type === "root" && children.every((n) => n.position)) {
        // The order of comments and frontmatter may be changed.
        children = [...children].sort(
            (a, b) => a.position!.start.offset - b.position!.start.offset,
        )
    }
    for (const node of children) {
        cb(node, parent)
        if (isParent(node)) {
            walkElements(node, cb)
        }
    }
}

/** walk nodes */
export function walk(
    parent: ParentNode,
    enter: (n: Node | AttributeNode, parent: ParentNode) => void,
    leave?: (n: Node | AttributeNode, parent: ParentNode) => void,
): void {
    let children = parent.children
    if (parent.type === "root" && children.every((n) => n.position)) {
        // The order of comments and frontmatter may be changed.
        children = [...children].sort(
            (a, b) => a.position!.start.offset - b.position!.start.offset,
        )
    }
    for (const node of children) {
        enter(node, parent)
        if (isTag(node)) {
            for (const attr of node.attributes) {
                enter(attr, node)
                leave?.(attr, node)
            }
        }
        if (isParent(node)) {
            walk(node, enter, leave)
        }
        leave?.(node, parent)
    }
}
