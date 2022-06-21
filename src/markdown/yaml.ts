import type { CST, Document } from "yaml"
import { parseDocument, isScalar, isMap } from "yaml"
import type { MarkdownContent } from "./frontmatter"

export type FrontmatterYAMLResult = {
    before: number
    setupValueRange: [number, number]
    after: number
    getYamlValue: () => any
}
/** Parse for yaml */
export function parseYaml(
    frontmatter: MarkdownContent,
): FrontmatterYAMLResult | null {
    const doc = parseDocument(frontmatter.value, { keepSourceTokens: true })
    const range = getSetupRange(doc)
    if (!range) {
        return null
    }
    let before = range[0]
    let after = range[1]
    while (isSpace(frontmatter.value[before - 1])) {
        before--
    }
    while (isSpace(frontmatter.value[after])) {
        after++
    }
    return {
        before: before + frontmatter.range[0],
        setupValueRange: [
            range[0] + frontmatter.range[0],
            range[1] + frontmatter.range[0],
        ],
        after: after + frontmatter.range[0],
        getYamlValue: () => doc.toJS(),
    }
}

/**  Checks whether the given char is spaces, or not */
function isSpace(c: string | undefined) {
    return c && !c.trim()
}

/** Get setup range */
function getSetupRange(ast: Document.Parsed): [number, number] | null {
    if (!ast.contents) {
        return null
    }
    if (!isMap(ast.contents)) {
        return null
    }
    for (const item of ast.contents.items) {
        if (!isScalar(item.key) || !isScalar(item.value)) {
            continue
        }
        if (item.key.value !== "setup") {
            continue
        }
        if (item.value.type === "PLAIN") {
            return [item.value.range[0], item.value.range[1]]
        }
        if (
            item.value.type === "QUOTE_DOUBLE" ||
            item.value.type === "QUOTE_SINGLE"
        ) {
            return [item.value.range[0] + 1, item.value.range[1] - 1]
        }
        if (
            item.value.type === "BLOCK_FOLDED" ||
            item.value.type === "BLOCK_LITERAL"
        ) {
            const cst = item.value.srcToken! as CST.BlockScalar
            let blockStart = cst.offset
            for (const token of cst.props) {
                if (
                    isCommentOrSpace(token) ||
                    token.type === "block-scalar-header"
                ) {
                    blockStart = token.offset + token.source.length
                    continue
                }
                /* istanbul ignore next */
                throw new Error(`Unknown token:${token.type}`)
            }
            return [blockStart, item.value.range[1]]
        }

        break
    }
    return null
}

/**
 * Checks whether the given cst is comments, spaces, or not
 */
function isCommentOrSpace(
    node: CST.Token,
): node is CST.SourceToken & { type: "space" | "comment" | "newline" } {
    if (
        node.type === "space" ||
        node.type === "newline" ||
        node.type === "comment"
    ) {
        return true
    }
    return false
}
