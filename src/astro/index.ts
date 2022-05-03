import type {
    AttributeNode,
    CommentNode,
    DoctypeNode,
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
    code: string,
    cb: (n: Node, parent: ParentNode) => void,
): void {
    const children = getSortedChildren(parent, code)
    for (const node of children) {
        cb(node, parent)
        if (isParent(node)) {
            walkElements(node, code, cb)
        }
    }
}

/** walk nodes */
export function walk(
    parent: ParentNode,
    code: string,
    enter: (n: Node | AttributeNode, parent: ParentNode) => void,
    leave?: (n: Node | AttributeNode, parent: ParentNode) => void,
): void {
    const children = getSortedChildren(parent, code)
    for (const node of children) {
        enter(node, parent)
        if (isTag(node)) {
            for (const attr of node.attributes) {
                enter(attr, node)
                leave?.(attr, node)
            }
        }
        if (isParent(node)) {
            walk(node, code, enter, leave)
        }
        leave?.(node, parent)
    }
}

/**
 * Get end offset of start tag
 */
export function getStartTagEndOffset(node: TagLikeNode, code: string): number {
    const lastAttr = node.attributes[node.attributes.length - 1]
    let beforeCloseIndex: number
    if (lastAttr) {
        beforeCloseIndex = getAttributeEndOffset(lastAttr, code)
    } else {
        const info = getTokenInfo(
            code,
            [`<${node.name}`],
            node.position!.start.offset,
        )
        beforeCloseIndex = info.index + info.match.length
    }
    const info = getTokenInfo(code, [[">", "/>"]], beforeCloseIndex)
    return info.index + info.match.length
}

/**
 * Get end offset of attribute
 */
export function getAttributeEndOffset(
    node: AttributeNode,
    code: string,
): number {
    let info
    if (node.kind === "empty") {
        info = getTokenInfo(code, [node.name], node.position!.start.offset)
    } else if (node.kind === "quoted") {
        info = getTokenInfo(
            code,
            [[`"${node.value}"`, `'${node.value}'`, node.value]],
            getAttributeValueStartOffset(node, code),
        )
    } else if (node.kind === "expression") {
        info = getTokenInfo(
            code,
            ["{", node.value, "}"],
            getAttributeValueStartOffset(node, code),
        )
    } else if (node.kind === "shorthand") {
        info = getTokenInfo(
            code,
            ["{", node.name, "}"],
            node.position!.start.offset,
        )
    } else if (node.kind === "spread") {
        info = getTokenInfo(
            code,
            ["{", "...", node.name, "}"],
            node.position!.start.offset,
        )
    } else if (node.kind === "template-literal") {
        info = getTokenInfo(
            code,
            [`\`${node.value}\``],
            getAttributeValueStartOffset(node, code),
        )
    } else {
        throw new Error(`Unknown attr kind: ${node.kind}`)
    }
    return info.index + info.match.length
}

/**
 * Get start offset of attribute value
 */
export function getAttributeValueStartOffset(
    node: AttributeNode,
    code: string,
): number {
    let info
    if (node.kind === "quoted") {
        info = getTokenInfo(
            code,
            [node.name, "=", [`"`, `'`, node.value]],
            node.position!.start.offset,
        )
    } else if (node.kind === "expression") {
        info = getTokenInfo(
            code,
            [node.name, "=", "{"],
            node.position!.start.offset,
        )
    } else if (node.kind === "template-literal") {
        info = getTokenInfo(
            code,
            [node.name, "=", "`"],
            node.position!.start.offset,
        )
    } else {
        throw new Error(`Unknown attr kind: ${node.kind}`)
    }
    return info.index
}

/**
 * Get end offset of comment
 */
export function getCommentEndOffset(node: CommentNode, code: string): number {
    const info = getTokenInfo(
        code,
        ["<!--", node.value, "-->"],
        node.position!.start.offset,
    )

    return info.index + info.match.length
}

/**
 * Get token info
 */
function getTokenInfo(
    string: string,
    tokens: (string | string[])[],
    position: number,
): {
    match: string
    index: number
} {
    let lastMatch:
        | {
              match: string
              index: number
          }
        | undefined
    for (const t of tokens) {
        const index = lastMatch
            ? lastMatch.index + lastMatch.match.length
            : position
        const m =
            typeof t === "string"
                ? matchOfStr(t, index)
                : matchOfForMulti(t, index)
        if (m == null) {
            throw new Error(
                `Unknown token at ${index}, expected: ${JSON.stringify(
                    t,
                )}, actual: ${JSON.stringify(string.slice(index, index + 10))}`,
            )
        }
        lastMatch = m
    }
    return lastMatch!

    /**
     * For string
     */
    function matchOfStr(search: string, position: number) {
        const index =
            search.trim() === search ? skipSpaces(string, position) : position
        if (string.startsWith(search, index)) {
            return {
                match: search,
                index,
            }
        }
        return null
    }

    /**
     * For multi
     */
    function matchOfForMulti(search: string[], position: number) {
        for (const s of search) {
            const m = matchOfStr(s, position)
            if (m) {
                return m
            }
        }
        return null
    }
}

/**
 * Skip spaces
 */
export function skipSpaces(string: string, position: number): number {
    const re = /\s*/g
    re.lastIndex = position
    const match = re.exec(string)
    if (match) {
        return match.index + match[0].length
    }
    return position
}

/**
 * Get children
 */
function getSortedChildren(parent: ParentNode, code: string) {
    if (parent.type === "root" && parent.children[0]?.type === "frontmatter") {
        // The order of comments and frontmatter may be changed.
        const children = [...parent.children]
        if (children.every((n) => n.position)) {
            return children.sort(
                (a, b) => a.position!.start.offset - b.position!.start.offset,
            )
        }
        let start = skipSpaces(code, 0)
        if (code.startsWith("<!", start)) {
            const frontmatter = children.shift()!
            const before: (CommentNode | DoctypeNode)[] = []
            let first
            while ((first = children.shift())) {
                start = skipSpaces(code, start)
                if (
                    first.type === "comment" &&
                    code.startsWith("<!--", start)
                ) {
                    start = code.indexOf("-->", start + 4) + 3
                    before.push(first)
                } else if (
                    first.type === "doctype" &&
                    code.startsWith("<!", start)
                ) {
                    start = code.indexOf(">", start + 2) + 1
                    before.push(first)
                } else {
                    children.unshift(first)
                    break
                }
            }
            return [...before, frontmatter, ...children]
        }
    }
    return parent.children
}
