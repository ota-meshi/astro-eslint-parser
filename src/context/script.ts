import type { Context } from "."
import type { ESLintExtendedProgram } from "../parser"
import { traverseNodes } from "../traverse"
import type { TSESTree } from "@typescript-eslint/types"
import { ParseError } from "../errors"
import type { AstroProgram, AstroRootFragment } from "../ast"

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

        // Process for Astro
        const rootFragment = ((result.ast as AstroProgram).body[
            result.ast.body.length - 1
        ] = last.expression as unknown as AstroRootFragment)
        delete (rootFragment as any).closingFragment
        delete (rootFragment as any).openingFragment
        rootFragment.type = "AstroRootFragment"

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
