import type { Context } from "../context"
import fs from "fs"
import { debug } from "../debug"
import type { ParserOptionsContext } from "../context/parser-options"
import type { ESLintExtendedProgram } from "../types"

/**
 * Parse for script
 */
export function parseScript(
    code: string,
    _ctx: Context,
    parserOptions: ParserOptionsContext,
): ESLintExtendedProgram {
    const parser = parserOptions.getParser()

    let removeFile: string | null = null

    try {
        const scriptParserOptions = { ...parserOptions.parserOptions }
        if (parserOptions.isTypeScript() && scriptParserOptions.filePath) {
            scriptParserOptions.filePath += ".tsx"
            if (!fs.existsSync(scriptParserOptions.filePath)) {
                fs.writeFileSync(
                    scriptParserOptions.filePath,
                    "/* temp for astro-eslint-parser */",
                )
                removeFile = scriptParserOptions.filePath
            }
        }
        const result =
            parser.parseForESLint?.(code, scriptParserOptions) ??
            parser.parse?.(code, scriptParserOptions)

        if ("ast" in result && result.ast != null) {
            return result
        }
        return { ast: result } as ESLintExtendedProgram
    } catch (e) {
        debug(
            "[script] parsing error:",
            (e as any).message,
            `@ ${JSON.stringify(code)}

${code}`,
        )
        throw e
    } finally {
        if (removeFile) fs.unlinkSync(removeFile)
    }
}
