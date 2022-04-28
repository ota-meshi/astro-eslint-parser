import { KEYS } from "../visitor-keys"
import { Context } from "../context"
import type { AstroProgram } from "../ast"
import { AST_TOKEN_TYPES } from "@typescript-eslint/types"
import type { TSESTree } from "@typescript-eslint/types"
import type { ScopeManager } from "eslint-scope"
import { parseScript } from "./script"
import { sort } from "./sort"
import { ParseError } from "../errors"
import type { ParseResult } from "@astrojs/compiler"
import { parse as parseAstro } from "./astro-parser/parse"
import { processTemplate } from "./process-template"

/**
 * The parsing result of ESLint custom parsers.
 */
export interface ESLintExtendedProgram {
    ast: TSESTree.Program
    services?: Record<string, any>
    visitorKeys?: { [type: string]: string[] }
    scopeManager?: ScopeManager
}
/**
 * Parse source code
 */
export function parseForESLint(
    code: string,
    options?: any,
): {
    ast: AstroProgram
    services: Record<string, any> & {
        isAstro: true
        getAstroAst: () => ParseResult
    }
    visitorKeys: { [type: string]: string[] }
    scopeManager: ScopeManager
} {
    const parserOptions = {
        ecmaVersion: 2020,
        sourceType: "module",
        loc: true,
        range: true,
        raw: true,
        tokens: true,
        comment: true,
        eslintVisitorKeys: true,
        eslintScopeManager: true,
        ...(options || {}),
    }
    parserOptions.ecmaFeatures = {
        ...(parserOptions.ecmaFeatures || {}),
        jsx: true,
    }
    parserOptions.sourceType = "module"
    if (parserOptions.ecmaVersion <= 5 || parserOptions.ecmaVersion == null) {
        parserOptions.ecmaVersion = 2015
    }

    const ctx = new Context(code, parserOptions)
    const resultTemplate = parseTemplate(ctx.code, ctx)
    const scriptContext = processTemplate(ctx, resultTemplate)

    const resultScript = parseScript(scriptContext.script, ctx)
    scriptContext.restore(resultScript)
    sort(resultScript.ast.comments!)
    sort(resultScript.ast.tokens!)
    extractTokens(resultScript, ctx)

    resultScript.services = Object.assign(resultScript.services || {}, {
        isAstro: true,
        getAstroAst() {
            return resultTemplate.ast
        },
    })
    resultScript.visitorKeys = Object.assign({}, KEYS, resultScript.visitorKeys)

    ctx.remapCR(resultScript)

    return resultScript as any
}

/** Extract tokens */
function extractTokens(ast: ESLintExtendedProgram, ctx: Context) {
    if (!ast.ast.tokens) {
        return
    }
    const useRanges = sort([
        ...ast.ast.tokens,
        ...(ast.ast.comments || []),
    ]).map((t) => t.range)
    let range = useRanges.shift()
    for (let index = 0; index < ctx.code.length; index++) {
        while (range && range[1] <= index) {
            range = useRanges.shift()
        }
        if (range && range[0] <= index) {
            index = range[1] - 1
            continue
        }
        const c = ctx.code[index]
        if (!c.trim()) {
            continue
        }
        if (isPunctuator(c)) {
            ast.ast.tokens.push(
                ctx.buildToken(AST_TOKEN_TYPES.Punctuator, [index, index + 1]),
            )
        } else {
            // unknown
            // It is may be a bug.
            ast.ast.tokens.push(
                ctx.buildToken(AST_TOKEN_TYPES.Identifier, [index, index + 1]),
            )
        }
    }
    sort(ast.ast.tokens)

    /**
     * Checks if the given char is punctuator
     */
    function isPunctuator(c: string) {
        return /^[^\w$]$/iu.test(c)
    }
}

/**
 * Parse for template
 */
export function parseTemplate(code: string, ctx: Context): ParseResult {
    try {
        return parseAstro(code)
    } catch (e: any) {
        if (typeof e.pos === "number") {
            const err = new ParseError(e.message, e.pos, ctx)
            ;(err as any).astroCompilerError = e
            throw err
        }
        throw e
    }
}
