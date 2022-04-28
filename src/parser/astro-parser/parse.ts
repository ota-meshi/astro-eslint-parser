import type {
    AttributeNode,
    ParentNode,
    TagLikeNode,
} from "@astrojs/compiler/types"
import type { ParseResult } from "@astrojs/compiler"
import * as service from "./astrojs-compiler-service"
import { walk } from "../../astro"

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
        // eslint-disable-next-line complexity -- ignore
        (node) => {
            if (node.type === "frontmatter") {
                start = node.position!.start.offset = tokenIndexOf(
                    code,
                    "---",
                    start,
                )
                start = node.position!.end!.offset =
                    tokenIndexOf(code, "---", start + 3 + node.value.length) + 3
            } else if (
                node.type === "fragment" ||
                node.type === "element" ||
                node.type === "component" ||
                node.type === "custom-element"
            ) {
                if (!node.position) {
                    node.position = { start: {}, end: {} } as any
                }
                start = node.position!.start.offset = tokenIndexOf(
                    code,
                    "<",
                    start,
                )
                start += 1
                if (
                    node.type === "element" ||
                    node.type === "component" ||
                    node.type === "custom-element"
                ) {
                    start += node.name.length
                }
                if (!node.attributes.length) {
                    const info = getTokenInfo(code, [[">", "/>"]], start)
                    start = info.index + info.match.length
                }
            } else if (node.type === "attribute") {
                start = fixLocationForAttr(node, code, start)
            } else if (node.type === "comment") {
                start = node.position!.start.offset = tokenIndexOf(
                    code,
                    "<!--",
                    start,
                )
                start += 4
                const info = getTokenInfo(code, [node.value, "-->"], start)
                start = info.index + info.match.length
            } else if (node.type === "text") {
                start = node.position!.start.offset = tokenIndexOf(
                    code,
                    node.value,
                    start,
                )
                start += node.value.length
            } else if (node.type === "expression") {
                start = node.position!.start.offset = tokenIndexOf(
                    code,
                    "{",
                    start,
                )
                start += 1
            } else if (node.type === "doctype") {
                if (!node.position) {
                    node.position = { start: {}, end: {} } as any
                }
                start = node.position!.start.offset = tokenIndexOf(
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
                    const info = getTokenInfo(code, [[">", "/>"]], start)
                    start = info.index + info.match.length
                }
                return
            }
            if (node.type === "expression") {
                start = tokenIndexOf(code, "}", start) + 1
            } else if (node.type === "fragment") {
                start = tokenIndexOf(code, "</>", start) + 3
            } else if (
                node.type === "element" ||
                node.type === "component" ||
                node.type === "custom-element"
            ) {
                if (!node.position!.end) {
                    return
                }
                start =
                    tokenIndexOf(code, `</${node.name}`, start) +
                    2 +
                    node.name.length
                start = tokenIndexOf(code, ">", start) + 1
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
function fixLocationForAttr(
    node: AttributeNode,
    code: string,
    start: number,
): number {
    let info
    if (node.kind === "empty") {
        const index = (node.position!.start.offset = tokenIndexOf(
            code,
            node.name,
            start,
        ))
        return index + node.name.length
    } else if (node.kind === "quoted") {
        const index = (node.position!.start.offset = tokenIndexOf(
            code,
            node.name,
            start,
        ))
        info = getTokenInfo(
            code,
            ["=", [`"${node.value}"`, `'${node.value}'`, node.value]],
            index + node.name.length,
        )
    } else if (node.kind === "expression") {
        const index = (node.position!.start.offset = tokenIndexOf(
            code,
            node.name,
            start,
        ))
        info = getTokenInfo(
            code,
            ["=", "{", node.value, "}"],
            index + node.name.length,
        )
    } else if (node.kind === "shorthand") {
        const index = (node.position!.start.offset = tokenIndexOf(
            code,
            "{",
            start,
        ))
        info = getTokenInfo(code, [node.name, "}"], index + 1)
    } else if (node.kind === "spread") {
        const index = (node.position!.start.offset = tokenIndexOf(
            code,
            "{",
            start,
        ))
        info = getTokenInfo(code, ["...", node.value, "}"], index + 1)
    } else if (node.kind === "template-literal") {
        const index = (node.position!.start.offset = tokenIndexOf(
            code,
            node.name,
            start,
        ))
        info = getTokenInfo(
            code,
            ["=", `\`${node.value}\``],
            index + node.name.length,
        )
    } else {
        throw new Error(`Unknown attr kind: ${node.kind}`)
    }
    return info.index + info.match.length
}

/**
 * Get token index
 */
function tokenIndexOf(string: string, token: string, position: number): number {
    const index =
        token.trim() === token ? skipSpaces(string, position) : position
    if (string.startsWith(token, index)) {
        return index
    }
    throw new Error(
        `Unknown token at ${index}, expected: ${JSON.stringify(
            token,
        )}, actual: ${JSON.stringify(string.slice(index, index + 10))}`,
    )
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
function skipSpaces(string: string, position: number) {
    const re = /\s*/g
    re.lastIndex = position
    const match = re.exec(string)
    if (match) {
        return match.index + match[0].length
    }
    return position
}
