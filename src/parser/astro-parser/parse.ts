import type {
    AttributeNode,
    ParentNode,
    TagLikeNode,
} from "@astrojs/compiler/types"
import type { ParseResult } from "@astrojs/compiler"
import * as service from "./astrojs-compiler-service"
import {
    getAttributeEndOffset,
    getCommentEndOffset,
    getStartTagEndOffset,
    skipSpaces,
    walk,
} from "../../astro"

/**
 * Parse code by `@astrojs/compiler`
 */
export function parse(code: string): ParseResult {
    const ast = service.parse(code, { position: true }).ast
    fixLocations(ast, code)
    return { ast }
}

/**
 * Fix locations
 */
function fixLocations(node: ParentNode, code: string): void {
    // FIXME: Adjust because the parser does not return the correct location.
    let start = 0
    walk(
        node,
        code,
        (node) => {
            if (node.type === "frontmatter") {
                start = node.position!.start.offset = tokenIndex(
                    code,
                    "---",
                    start,
                )
                start = node.position!.end!.offset =
                    tokenIndex(code, "---", start + 3 + node.value.length) + 3
            } else if (
                node.type === "fragment" ||
                node.type === "element" ||
                node.type === "component" ||
                node.type === "custom-element"
            ) {
                if (!node.position) {
                    node.position = { start: {}, end: {} } as any
                }
                start = node.position!.start.offset = tokenIndex(
                    code,
                    "<",
                    start,
                )
                start += 1
                start += node.name.length
                if (!node.attributes.length) {
                    start = getStartTagEndOffset(node, code)
                }
            } else if (node.type === "attribute") {
                fixLocationForAttr(node, code, start)
                start = getAttributeEndOffset(node, code)
            } else if (node.type === "comment") {
                node.position!.start.offset = tokenIndex(code, "<!--", start)
                start = getCommentEndOffset(node, code)
            } else if (node.type === "text") {
                start = node.position!.start.offset = tokenIndex(
                    code,
                    node.value,
                    start,
                )
                start += node.value.length
            } else if (node.type === "expression") {
                start = node.position!.start.offset = tokenIndex(
                    code,
                    "{",
                    start,
                )
                start += 1
            } else if (node.type === "doctype") {
                if (!node.position) {
                    node.position = { start: {}, end: {} } as any
                }
                if (!node.position!.end) {
                    node.position!.end = {} as any
                }
                start = node.position!.start.offset = tokenIndex(
                    code,
                    "<!",
                    start,
                )
                start += 2
                start = node.position!.end!.offset =
                    code.indexOf(">", start) + 1
            } else if (node.type === "root") {
                // noop
            }
        },
        (node, parent) => {
            if (node.type === "attribute") {
                const attributes = (parent as TagLikeNode).attributes
                if (attributes[attributes.length - 1] === node) {
                    start = getStartTagEndOffset(parent as TagLikeNode, code)
                }
                return
            }
            if (node.type === "expression") {
                start = tokenIndex(code, "}", start) + 1
            } else if (
                node.type === "fragment" ||
                node.type === "element" ||
                node.type === "component" ||
                node.type === "custom-element"
            ) {
                const closeTagStart = tokenIndexSafe(
                    code,
                    `</${node.name}`,
                    start,
                )
                if (closeTagStart != null) {
                    start = closeTagStart + 2 + node.name.length
                    start = tokenIndex(code, ">", start) + 1
                }
            } else {
                return
            }
            if (node.position!.end) {
                node.position!.end.offset = start
            }
        },
    )
}

/**
 * Fix locations
 */
function fixLocationForAttr(node: AttributeNode, code: string, start: number) {
    if (node.kind === "empty") {
        node.position!.start.offset = tokenIndex(code, node.name, start)
    } else if (node.kind === "quoted") {
        node.position!.start.offset = tokenIndex(code, node.name, start)
    } else if (node.kind === "expression") {
        node.position!.start.offset = tokenIndex(code, node.name, start)
    } else if (node.kind === "shorthand") {
        node.position!.start.offset = tokenIndex(code, "{", start)
    } else if (node.kind === "spread") {
        node.position!.start.offset = tokenIndex(code, "{", start)
    } else if (node.kind === "template-literal") {
        node.position!.start.offset = tokenIndex(code, node.name, start)
    } else {
        throw new Error(`Unknown attr kind: ${node.kind}`)
    }
}

/**
 * Get token index
 */
function tokenIndex(string: string, token: string, position: number): number {
    const index = tokenIndexSafe(string, token, position)
    if (index == null) {
        const start =
            token.trim() === token ? skipSpaces(string, position) : position
        throw new Error(
            `Unknown token at ${start}, expected: ${JSON.stringify(
                token,
            )}, actual: ${JSON.stringify(string.slice(start, start + 10))}`,
        )
    }
    return index
}

/**
 * Get token index
 */
function tokenIndexSafe(
    string: string,
    token: string,
    position: number,
): number | null {
    const index =
        token.trim() === token ? skipSpaces(string, position) : position
    if (string.startsWith(token, index)) {
        return index
    }
    return null
}
