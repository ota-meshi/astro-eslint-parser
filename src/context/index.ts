import path from "path"
import fs from "fs"
import type { TSESTree } from "@typescript-eslint/types"
import { getParserName } from "../parser/resolve-parser"
import { traverseNodes } from "../traverse"
import type { ESLintExtendedProgram } from "../parser"
type RangeAndLoc = {
    range: TSESTree.Range
    loc: TSESTree.SourceLocation
}
export class Context {
    public readonly code: string

    public readonly parserOptions: any

    public readonly locs: LinesAndColumns

    private readonly locsMap = new Map<number, TSESTree.Position>()

    private state: { isTypeScript?: boolean } = {}

    public constructor(code: string, parserOptions: any) {
        this.locs = new LinesAndColumns(code)
        this.code = this.locs.code
        this.parserOptions = parserOptions
    }

    public getLocFromIndex(index: number): { line: number; column: number } {
        let loc = this.locsMap.get(index)
        if (!loc) {
            loc = this.locs.getLocFromIndex(index)
            this.locsMap.set(index, loc)
        }
        return {
            line: loc.line,
            column: loc.column,
        }
    }

    /**
     * Get the location information of the given indexes.
     */
    public getLocations(start: number, end: number): RangeAndLoc {
        return {
            range: [start, end],
            loc: {
                start: this.getLocFromIndex(start),
                end: this.getLocFromIndex(end),
            },
        }
    }

    /**
     * Build token
     */
    public buildToken(
        type: TSESTree.Token["type"],
        range: TSESTree.Range,
    ): TSESTree.Token {
        return {
            type,
            value: this.getText(range),
            ...this.getLocations(...range),
        } as TSESTree.Token
    }

    /**
     * get text
     */
    public getText(range: TSESTree.Range): string {
        return this.code.slice(range[0], range[1])
    }

    public isTypeScript(): boolean {
        if (this.state.isTypeScript != null) {
            return this.state.isTypeScript
        }
        const parserName = getParserName({}, this.parserOptions?.parser)
        if (parserName === "@typescript-eslint/parser") {
            return (this.state.isTypeScript = true)
        }
        if (parserName.includes("@typescript-eslint/parser")) {
            let targetPath = parserName
            while (targetPath) {
                const pkgPath = path.join(targetPath, "package.json")
                if (fs.existsSync(pkgPath)) {
                    try {
                        return (this.state.isTypeScript =
                            JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
                                ?.name === "@typescript-eslint/parser")
                    } catch {
                        return (this.state.isTypeScript = false)
                    }
                }
                const parent = path.dirname(targetPath)
                if (targetPath === parent) {
                    break
                }
                targetPath = parent
            }
        }

        return (this.state.isTypeScript = false)
    }

    public remapCR({ ast, visitorKeys }: ESLintExtendedProgram): void {
        const crs = this.locs.getCRs()
        if (!crs.length) {
            return
        }
        const cache: Record<number, number> = {}

        /**
         * Remap index
         */
        function remapIndex(index: number) {
            let result = cache[index]
            if (result != null) {
                return result
            }
            result = index
            for (const cr of crs) {
                if (cr < result) {
                    result++
                } else {
                    break
                }
            }
            return (cache[index] = result)
        }

        /**
         * Remap range
         */
        function remapRange(range: TSESTree.Range): TSESTree.Range {
            return [remapIndex(range[0]), remapIndex(range[1])]
        }

        traverseNodes(ast, {
            visitorKeys,
            enterNode(node) {
                node.range = remapRange(node.range)
            },
            leaveNode() {
                // ignore
            },
        })
        for (const token of ast.tokens || []) {
            token.range = remapRange(token.range)
        }
        for (const comment of ast.comments || []) {
            comment.range = remapRange(comment.range)
        }
    }
}

export class LinesAndColumns {
    public readonly code: string

    private readonly crs: number[]

    private readonly lineStartIndices: number[]

    public constructor(origCode: string) {
        const len = origCode.length
        const lineStartIndices = [0]
        const crs = []
        let code = ""
        for (let index = 0; index < len; ) {
            const c = origCode[index++]
            if (c === "\r") {
                const next = origCode[index++] || ""
                if (next === "\n") {
                    code += next
                    crs.push(index - 2)
                } else {
                    code += `\n${next}`
                }
                lineStartIndices.push(code.length)
            } else {
                code += c
                if (c === "\n") {
                    lineStartIndices.push(code.length)
                }
            }
        }

        this.lineStartIndices = lineStartIndices
        this.code = code
        this.crs = crs
    }

    public getLocFromIndex(index: number): { line: number; column: number } {
        const lineNumber = sortedLastIndex(this.lineStartIndices, index)
        return {
            line: lineNumber,
            column: index - this.lineStartIndices[lineNumber - 1],
        }
    }

    public getIndexFromLoc(loc: { line: number; column: number }): number {
        const lineStartIndex = this.lineStartIndices[loc.line - 1]
        const positionIndex = lineStartIndex + loc.column

        return positionIndex
    }

    public getCRs(): number[] {
        return this.crs
    }
}

/**
 * Uses a binary search to determine the highest index at which value should be inserted into array in order to maintain its sort order.
 */
function sortedLastIndex(array: number[], value: number): number {
    let lower = 0
    let upper = array.length

    while (lower < upper) {
        const mid = Math.floor(lower + (upper - lower) / 2)
        const target = array[mid]
        if (target < value) {
            lower = mid + 1
        } else if (target > value) {
            upper = mid
        } else {
            return mid + 1
        }
    }

    return upper
}
