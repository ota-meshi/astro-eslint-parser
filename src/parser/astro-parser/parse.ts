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
import type { Context } from "../../context"
import { ParseError } from "../../errors"

/**
 * Parse code by `@astrojs/compiler`
 */
export function parse(code: string, ctx: Context): ParseResult {
    const ast = service.parse(code, { position: true }).ast
    fixLocations(ast, ctx)
    return { ast }
}

/**
 * Fix locations
 */
function fixLocations(node: ParentNode, ctx: Context): void {
    // FIXME: Adjust because the parser does not return the correct location.
    let start = 0
    walk(
        node,
        ctx.code,
        (node) => {
            if (node.type === "frontmatter") {
                start = node.position!.start.offset = tokenIndex(
                    ctx,
                    "---",
                    start,
                )
                start = node.position!.end!.offset =
                    tokenIndex(ctx, "---", start + 3 + node.value.length) + 3
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
                    ctx,
                    "<",
                    start,
                )
                start += 1
                start += node.name.length
                if (!node.attributes.length) {
                    start = getStartTagEndOffset(node, ctx)
                }
            } else if (node.type === "attribute") {
                fixLocationForAttr(node, ctx, start)
                start = getAttributeEndOffset(node, ctx)
            } else if (node.type === "comment") {
                node.position!.start.offset = tokenIndex(ctx, "<!--", start)
                start = getCommentEndOffset(node, ctx)
            } else if (node.type === "text") {
                start = node.position!.start.offset = tokenIndex(
                    ctx,
                    node.value,
                    start,
                )
                start += node.value.length
            } else if (node.type === "expression") {
                start = node.position!.start.offset = tokenIndex(
                    ctx,
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
                    ctx,
                    "<!",
                    start,
                )
                start += 2
                start = node.position!.end!.offset =
                    ctx.code.indexOf(">", start) + 1
            } else if (node.type === "root") {
                // noop
            }
        },
        (node, parent) => {
            if (node.type === "attribute") {
                const attributes = (parent as TagLikeNode).attributes
                if (attributes[attributes.length - 1] === node) {
                    start = getStartTagEndOffset(parent as TagLikeNode, ctx)
                }
                return
            }
            if (node.type === "expression") {
                start = tokenIndex(ctx, "}", start) + 1
            } else if (
                node.type === "fragment" ||
                node.type === "element" ||
                node.type === "component" ||
                node.type === "custom-element"
            ) {
                const closeTagStart = tokenIndexSafe(
                    ctx.code,
                    `</${node.name}`,
                    start,
                )
                if (closeTagStart != null) {
                    start = closeTagStart + 2 + node.name.length
                    start = tokenIndex(ctx, ">", start) + 1
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
function fixLocationForAttr(node: AttributeNode, ctx: Context, start: number) {
    if (node.kind === "empty") {
        node.position!.start.offset = tokenIndex(ctx, node.name, start)
    } else if (node.kind === "quoted") {
        node.position!.start.offset = tokenIndex(ctx, node.name, start)
    } else if (node.kind === "expression") {
        node.position!.start.offset = tokenIndex(ctx, node.name, start)
    } else if (node.kind === "shorthand") {
        node.position!.start.offset = tokenIndex(ctx, "{", start)
    } else if (node.kind === "spread") {
        node.position!.start.offset = tokenIndex(ctx, "{", start)
    } else if (node.kind === "template-literal") {
        node.position!.start.offset = tokenIndex(ctx, node.name, start)
    } else {
        throw new ParseError(
            `Unknown attr kind: ${node.kind}`,
            node.position!.start.offset,
            ctx,
        )
    }
}

/**
 * Get token index
 */
function tokenIndex(ctx: Context, token: string, position: number): number {
    const index = tokenIndexSafe(ctx.code, token, position)
    if (index == null) {
        const start =
            token.trim() === token ? skipSpaces(ctx.code, position) : position
        throw new ParseError(
            `Unknown token at ${start}, expected: ${JSON.stringify(
                token,
            )}, actual: ${JSON.stringify(ctx.code.slice(start, start + 10))}`,
            start,
            ctx,
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
