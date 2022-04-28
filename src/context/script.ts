import type { ParseResult } from "@astrojs/compiler"
import type { TagLikeNode, ParentNode } from "@astrojs/compiler/types"
import type { Context } from "."
import type { ESLintExtendedProgram } from "../parser"
import { traverseNodes } from "../traverse"
import { AST_TOKEN_TYPES, AST_NODE_TYPES } from "@typescript-eslint/types"
import type { TSESTree } from "@typescript-eslint/types"
import { ParseError } from "../errors"
import type { AstroDoctype, AstroHTMLComment, AstroRootFragment } from "../ast"
import { isTag, walkElements } from "../astro"

/**
 * Process the template to generate a ScriptContext.
 */
export function processTemplate(
    ctx: Context,
    resultTemplate: ParseResult,
): ScriptContext {
    const script = new ScriptContext(ctx)

    const frontmatter = resultTemplate.ast.children.find(
        (n) => n.type === "frontmatter",
    )
    let fragmentOpened = false
    if (!frontmatter) {
        script.appendScript("<>")
        fragmentOpened = true
    }

    walkElements(resultTemplate.ast, (node, parent) => {
        if (node.type === "frontmatter") {
            const start = node.position!.start.offset
            script.appendOriginal(start)
            script.skipOriginalOffset(3)
            const end = node.position!.end!.offset
            script.appendOriginal(end - 3)

            script.appendScript(";<>")
            fragmentOpened = true
            script.skipOriginalOffset(3)

            script.addRestoreNodeProcess((_scriptNode, result) => {
                for (let index = 0; index < result.ast.body.length; index++) {
                    const st = result.ast.body[index] as TSESTree.Node
                    if (st.type === AST_NODE_TYPES.EmptyStatement) {
                        if (st.range[0] === end - 3 && st.range[1] === end) {
                            result.ast.body.splice(index, 1)
                            break
                        }
                    }
                }
                return true
            })

            script.addToken(AST_TOKEN_TYPES.Punctuator, [
                node.position!.start.offset,
                node.position!.start.offset + 3,
            ])
            script.addToken(AST_TOKEN_TYPES.Punctuator, [end - 3, end])
        } else if (isTag(node)) {
            const end = getVoidSelfClosingTag(node, parent, ctx)
            if (end && end.match === ">") {
                script.appendOriginal(end.index)
                script.appendScript("/")
            }
            if (node.name === "script" || node.name === "style") {
                const text = node.children[0]
                if (text && text.type === "text") {
                    const styleNodeStart = node.position!.start.offset
                    const start = text.position!.start.offset
                    script.appendOriginal(start)
                    script.skipOriginalOffset(text.value.length)

                    script.addRestoreNodeProcess((scriptNode) => {
                        if (
                            scriptNode.type === AST_NODE_TYPES.JSXElement &&
                            scriptNode.range[0] === styleNodeStart
                        ) {
                            const textNode: TSESTree.JSXText = {
                                type: AST_NODE_TYPES.JSXText,
                                value: text.value,
                                raw: text.value,
                                parent: scriptNode,
                                ...ctx.getLocations(
                                    start,
                                    start + text.value.length,
                                ),
                            }
                            scriptNode.children = [textNode]
                            return true
                        }
                        return false
                    })
                    script.addToken(AST_TOKEN_TYPES.JSXText, [
                        start,
                        start + text.value.length,
                    ])
                }
            }
        } else if (node.type === "comment") {
            const start = node.position!.start.offset
            const length = 4 + node.value.length + 3
            script.appendOriginal(start)
            let targetType: AST_NODE_TYPES
            if (fragmentOpened) {
                script.appendScript(`<></>`)
                targetType = AST_NODE_TYPES.JSXFragment
            } else {
                script.appendScript(`0;`)
                targetType = AST_NODE_TYPES.ExpressionStatement
            }
            script.skipOriginalOffset(length)

            script.addRestoreNodeProcess((scriptNode) => {
                if (
                    scriptNode.range[0] === start &&
                    scriptNode.type === targetType
                ) {
                    delete (scriptNode as any).children
                    delete (scriptNode as any).openingFragment
                    delete (scriptNode as any).closingFragment
                    delete (scriptNode as any).expression
                    const commentNode =
                        scriptNode as unknown as AstroHTMLComment
                    commentNode.type = "AstroHTMLComment"
                    commentNode.value = node.value
                    return true
                }
                return false
            })
            script.addToken("HTMLComment" as AST_TOKEN_TYPES, [
                start,
                start + length,
            ])
        } else if (node.type === "doctype") {
            const start = node.position!.start.offset
            const end = node.position!.end!.offset
            script.appendOriginal(start)
            let targetType: AST_NODE_TYPES
            if (fragmentOpened) {
                script.appendScript(`<></>`)
                targetType = AST_NODE_TYPES.JSXFragment
            } else {
                script.appendScript(`0;`)
                targetType = AST_NODE_TYPES.ExpressionStatement
            }
            script.skipOriginalOffset(end - start)

            script.addRestoreNodeProcess((scriptNode) => {
                if (
                    scriptNode.range[0] === start &&
                    scriptNode.type === targetType
                ) {
                    delete (scriptNode as any).children
                    delete (scriptNode as any).openingFragment
                    delete (scriptNode as any).closingFragment
                    delete (scriptNode as any).expression
                    const doctypeNode = scriptNode as unknown as AstroDoctype
                    doctypeNode.type = "AstroDoctype"
                    return true
                }
                return false
            })
            script.addToken("HTMLDocType" as AST_TOKEN_TYPES, [start, end])
        }
    })

    script.appendOriginal(ctx.code.length)
    script.appendScript("</>")

    return script
}

/**
 * If the given tag is a void tag, get the self-closing tag.
 */
function getVoidSelfClosingTag(
    node: TagLikeNode,
    parent: ParentNode,
    ctx: Context,
) {
    if (node.type === "fragment") {
        return false
    }
    if (node.children.length > 0) {
        return false
    }
    const code = ctx.code
    let nextElementIndex = code.length
    const childIndex = parent.children.indexOf(node)
    if (childIndex === parent.children.length - 1) {
        // last
        nextElementIndex = parent.position!.end!.offset
        nextElementIndex = code.lastIndexOf("</", nextElementIndex)
    } else {
        const next = parent.children[childIndex + 1]
        nextElementIndex = next.position!.start.offset
    }
    const lastAttr = node.attributes[node.attributes.length - 1]
    let searchStartIndex: number, tokens: (string | string[])[]
    if (lastAttr) {
        searchStartIndex = lastAttr.position!.start.offset
        if (lastAttr.kind === "empty") {
            tokens = [lastAttr.name]
        } else if (lastAttr.kind === "quoted") {
            tokens = [
                lastAttr.name,
                "=",
                [`"${lastAttr.value}"`, `'${lastAttr.value}'`, lastAttr.value],
            ]
        } else if (lastAttr.kind === "expression") {
            tokens = [lastAttr.name, "=", "{", lastAttr.value, "}"]
        } else if (lastAttr.kind === "shorthand") {
            tokens = ["{", lastAttr.name, "}"]
        } else if (lastAttr.kind === "spread") {
            tokens = ["{", "...", lastAttr.value, "}"]
        } else if (lastAttr.kind === "template-literal") {
            tokens = [lastAttr.name, "=", `\`${lastAttr.value}\``]
        } else {
            throw new Error(`Unknown attr kind: ${lastAttr.kind}`)
        }
    } else {
        searchStartIndex = node.position!.start.offset
        tokens = [`<${node.name}`]
    }

    tokens.push([">", "/>"])
    const match = getEndTokenInfo(code, tokens, searchStartIndex)
    if (match == null) {
        throw new Error(
            `Unknown state on <${node.name}>@${node.position!.start.line}:${
                node.position!.start.column
            }`,
        )
    }
    if (code.slice(match.index + match.match.length, nextElementIndex).trim()) {
        // has end tag
        return null
    }
    return match
}

/**
 * Returns the information of the first occurrence of the matching substring.
 */
function getEndTokenInfo(
    string: string,
    tokens: (string | string[])[],
    position: number,
): {
    match: string
    index: number
} | null {
    let lastMatch:
        | {
              match: string
              index: number
          }
        | undefined
    for (const t of tokens) {
        const index = skipSpaces(
            lastMatch ? lastMatch.index + lastMatch.match.length : position,
        )
        const m =
            typeof t === "string"
                ? matchOfStr(t, index)
                : matchOfForMulti(t, index)
        if (m == null) {
            return null
        }
        lastMatch = m
    }
    if (lastMatch) {
        return lastMatch
    }
    return null

    /**
     * For string
     */
    function matchOfStr(search: string, position: number) {
        if (string.startsWith(search, position)) {
            return {
                match: search,
                index: position,
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

    /**
     * Skip spaces
     */
    function skipSpaces(position: number) {
        const re = /\s*/g
        re.lastIndex = position
        const match = re.exec(string)
        if (match) {
            return match.index + match[0].length
        }
        return position
    }
}

export class ScriptContext {
    private readonly ctx: Context

    public script = ""

    private consumedIndex = 0

    private readonly offsets: { original: number; script: number }[] = []

    private readonly fragments: { start: number; end: number }[] = []

    private readonly tokens: TSESTree.Token[] = []

    private readonly restoreNodeProcesses: ((
        node: TSESTree.Node,
        result: ESLintExtendedProgram,
    ) => boolean)[] = []

    public constructor(ctx: Context) {
        this.ctx = ctx
    }

    public skipOriginalOffset(offset: number): void {
        this.consumedIndex += offset
    }

    public appendOriginal(index: number): void {
        this.offsets.push({
            original: this.consumedIndex,
            script: this.script.length,
        })
        this.script += this.ctx.code.slice(this.consumedIndex, index)
        this.consumedIndex = index
    }

    public appendScript(fragment: string): void {
        const start = this.script.length
        this.script += fragment
        this.fragments.push({ start, end: this.script.length })
    }

    public addToken(type: TSESTree.Token["type"], range: TSESTree.Range): void {
        this.tokens.push(this.ctx.buildToken(type, range))
    }

    public addRestoreNodeProcess(
        process: (
            node: TSESTree.Node,
            result: ESLintExtendedProgram,
        ) => boolean,
    ): void {
        this.restoreNodeProcesses.push(process)
    }

    /**
     * Restore AST nodes
     */
    public restore(result: ESLintExtendedProgram): void {
        const last = result.ast.body[result.ast.body.length - 1]
        if (last.type !== "ExpressionStatement") {
            throw new ParseError(
                "Unknown state error: Expected ExpressionStatement",
                last.range[0],
                this.ctx,
            )
        }
        if (last.expression.type !== "JSXFragment") {
            throw new ParseError(
                "Unknown state error: Expected JSXFragment",
                last.expression.range[0],
                this.ctx,
            )
        }

        // remap locations

        const traversed = new Set<TSESTree.Node>()
        traverseNodes(result.ast, {
            visitorKeys: result.visitorKeys,
            enterNode: (node) => {
                if (!traversed.has(node)) {
                    traversed.add(node)

                    this.remapLocation(node)
                }
            },
            leaveNode: (_node) => {
                // noop
            },
        })
        const tokens: TSESTree.Token[] = [...this.tokens]
        for (const token of result.ast.tokens || []) {
            if (
                this.fragments.some(
                    (f) => f.start <= token.range[0] && token.range[1] <= f.end,
                )
            ) {
                continue
            }
            this.remapLocation(token)
            tokens.push(token)
        }
        result.ast.tokens = tokens
        for (const token of result.ast.comments || []) {
            this.remapLocation(token)
        }

        // Process for Astro
        delete (last.expression as any).closingFragment
        delete (last.expression as any).openingFragment
        ;(last.expression as unknown as AstroRootFragment).type =
            "AstroRootFragment"

        let restoreNodeProcesses = this.restoreNodeProcesses
        for (const node of traversed) {
            restoreNodeProcesses = restoreNodeProcesses.filter(
                (proc) => !proc(node, result),
            )
        }

        // Adjust program node location
        const first = result.ast.body[0]
        if (first.range[0] < result.ast.range[0]) {
            result.ast.range[0] = first.range[0]
            result.ast.loc.start = this.ctx.getLocFromIndex(result.ast.range[0])
        }
    }

    private remapLocation(node: TSESTree.Node | TSESTree.Token): void {
        let [start, end] = node.range
        const startFragment = this.fragments.find(
            (f) => f.start <= start && start < f.end,
        )
        if (startFragment) {
            start = startFragment.end
        }
        const endFragment = this.fragments.find(
            (f) => f.start < end && end <= f.end,
        )
        if (endFragment) {
            end = endFragment.start
        }

        if (end < start) {
            const w = start
            start = end
            end = w
        }

        const locs = this.ctx.getLocations(...this.getRemapRange(start, end))

        node.loc = locs.loc
        node.range = locs.range

        if ((node as any).start != null) {
            delete (node as any).start
        }
        if ((node as any).end != null) {
            delete (node as any).end
        }
    }

    private getRemapRange(start: number, end: number): TSESTree.Range {
        let lastStart = this.offsets[0]
        let lastEnd = this.offsets[0]
        for (const offset of this.offsets) {
            if (offset.script <= start) {
                lastStart = offset
            }
            if (offset.script < end) {
                lastEnd = offset
            } else {
                if (offset.script === end) {
                    const remapStart =
                        lastStart.original + (start - lastStart.script)
                    if (
                        this.tokens.some(
                            (t) =>
                                t.range[0] <= remapStart &&
                                offset.original <= t.range[1],
                        )
                    ) {
                        lastEnd = offset
                    }
                }
                break
            }
        }

        const remapStart = lastStart.original + (start - lastStart.script)
        const remapEnd = lastEnd.original + (end - lastEnd.script)
        return [remapStart, remapEnd]
    }
}
