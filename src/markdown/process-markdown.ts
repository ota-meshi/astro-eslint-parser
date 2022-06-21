import { AST_NODE_TYPES, AST_TOKEN_TYPES } from "@typescript-eslint/types"
import type * as mdast from "mdast"
import type { AstroRawText } from "../ast"
import type { ScriptContext } from "../context/script"

/**
 * Process the markdown ast to generate a ScriptContext.
 */
export function processMarkdown(
    script: ScriptContext,
    root: mdast.Root,
    offset: number,
): void {
    walk(
        root,
        (node) => {
            const start = node.position!.start.offset! + offset
            const end = node.position!.end.offset! + offset
            script.appendOriginal(start)

            if (node.type === "code" || node.type === "inlineCode") {
                script.appendScript(`<></>`)
                script.skipOriginalOffset(end - start)

                script.addRestoreNodeProcess((scriptNode, context) => {
                    if (
                        scriptNode.range[0] === start &&
                        scriptNode.type === AST_NODE_TYPES.JSXFragment
                    ) {
                        delete (scriptNode as any).openingFragment
                        delete (scriptNode as any).closingFragment
                        delete (scriptNode as any).expression
                        delete (scriptNode as any).children
                        const text = script.originalCode.slice(start, end)
                        const mdNode = scriptNode as unknown as AstroRawText
                        mdNode.type = "AstroRawText"
                        mdNode.value = text
                        mdNode.raw = text

                        let parent = context.getParent(scriptNode)
                        while (parent) {
                            let update = false
                            if (parent.range[0] > scriptNode.range[0]) {
                                parent.range[0] = scriptNode.range[0]
                                parent.loc.start = {
                                    line: scriptNode.loc.start.line,
                                    column: scriptNode.loc.start.column,
                                }
                                update = true
                            }
                            if (parent.range[1] < scriptNode.range[1]) {
                                parent.range[1] = scriptNode.range[1]
                                parent.loc.end = {
                                    line: scriptNode.loc.end.line,
                                    column: scriptNode.loc.end.column,
                                }
                                update = true
                            }

                            if (!update) {
                                break
                            }

                            parent = context.getParent(parent)
                        }
                        return true
                    }
                    return false
                })
                script.addToken(AST_TOKEN_TYPES.JSXText, [start, end])
            }
        },
        (node) => {
            // const start = node.position!.start.offset! + offset
            const end = node.position!.end.offset! + offset
            script.appendOriginal(end)
        },
    )

    script.addRestoreNodeProcess((scriptNode) => {
        if (scriptNode.type === "JSXText") {
            const rawNode = scriptNode as never as AstroRawText
            rawNode.type = "AstroRawText"
        }
        return false
    })
}

/** walk nodes */
function walk(
    parent: mdast.Content | mdast.Root,
    enter: (n: mdast.Content, parents: (mdast.Content | mdast.Root)[]) => void,
    leave: (n: mdast.Content, parents: (mdast.Content | mdast.Root)[]) => void,
    parents: (mdast.Content | mdast.Root)[] = [],
): void {
    const currParents = [parent, ...parents]
    if ("children" in parent) {
        for (const node of parent.children) {
            enter(node, currParents)
            walk(node, enter, leave, currParents)
            leave(node, currParents)
        }
    }
}
