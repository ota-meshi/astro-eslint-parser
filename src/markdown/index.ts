import type { ScopeManager } from "eslint-scope"
import type { AstroProgram } from "../ast"
import { Context } from "../context"
import { parseMarkdown } from "./mdast-util-from-markdown-service"
import { parseFrontmatter } from "./frontmatter"
import { processMarkdown } from "./process-markdown"
import { extractTokens, parseForESLint as parseAstro } from "../parser"
import { sort } from "../parser/sort"
import { ScriptContext } from "../context/script"
import type { FrontmatterYAMLResult } from "./yaml"
import { parseYaml } from "./yaml"
import type { ParseResult } from "@astrojs/compiler/node"
import type { AST_TOKEN_TYPES } from "@typescript-eslint/types"

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
        isAstroMarkdown: true
        getAstroMarkdownFrontmatter: () => any
    }
    visitorKeys: { [type: string]: string[] }
    scopeManager: ScopeManager
} {
    const { frontmatter, content } = parseFrontmatter(code)
    const ctx = new Context(code)
    const root = parseMarkdown(content.value)
    const scriptContext = new ScriptContext(ctx)
    let yamlResult: FrontmatterYAMLResult | undefined | null
    if (frontmatter) {
        scriptContext.appendOriginal(frontmatter.range[0])
        yamlResult = parseYaml(frontmatter)
        if (yamlResult) {
            scriptContext.skipOriginalOffset(
                yamlResult.setupValueRange[0] - frontmatter.range[0],
            )
            scriptContext.appendOriginal(yamlResult.setupValueRange[1])
            scriptContext.skipOriginalOffset(
                frontmatter.range[1] - yamlResult.setupValueRange[1],
            )
            scriptContext.addToken("YAMLToken" as AST_TOKEN_TYPES, [
                frontmatter.range[0],
                yamlResult.before,
            ])
            scriptContext.addToken("YAMLToken" as AST_TOKEN_TYPES, [
                yamlResult.after,
                frontmatter.range[1],
            ])
        } else {
            scriptContext.skipOriginalOffset(
                frontmatter.range[1] - frontmatter.range[0],
            )
            scriptContext.addToken("YAMLToken" as AST_TOKEN_TYPES, [
                frontmatter.range[0],
                frontmatter.range[1],
            ])
        }
    }
    processMarkdown(scriptContext, root, content.range[0])
    scriptContext.appendOriginal(code.length)

    const resultAstro = parseAstro(scriptContext.script, options)
    scriptContext.restore(resultAstro as never)
    sort(resultAstro.ast.comments)
    sort(resultAstro.ast.tokens)
    extractTokens(resultAstro as never, ctx)

    resultAstro.services = Object.assign(resultAstro.services || {}, {
        isAstroMarkdown: true,
        getAstroMarkdownFrontmatter() {
            return yamlResult?.getYamlValue()
        },
    })

    return resultAstro as any
}
