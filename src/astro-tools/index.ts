import type { ParseResult } from "@astrojs/compiler"
import { parseTemplate as parse } from "../parser/template"
import { getEndOffset, walk } from "../astro"
import type { AttributeNode, Node, ParentNode } from "@astrojs/compiler/types"

export interface ParseTemplateResult {
    result: ParseResult
    getEndOffset: (node: Node) => number
    walk: (
        parent: ParentNode,
        enter: (n: Node | AttributeNode, parents: ParentNode[]) => void,
        leave?: (n: Node | AttributeNode, parents: ParentNode[]) => void,
    ) => void
}
/**
 * Parse the astro component template.
 */
export function parseTemplate(code: string): ParseTemplateResult {
    const parsed = parse(code)
    return {
        result: parsed.result,
        getEndOffset: (node) => getEndOffset(node, parsed.context),
        walk(parent, enter, leave) {
            walk(
                parent,
                code,
                enter,
                leave ||
                    (() => {
                        /* noop */
                    }),
            )
        },
    }
}
