import type { ESLintExtendedProgram } from "."
import type { Context } from "../context"
import { getParser } from "./resolve-parser"
import fs from "fs"

/**
 * Parse for script
 */
export function parseScript(code: string, ctx: Context): ESLintExtendedProgram {
    const parser = getParser({}, ctx.parserOptions.parser)

    let removeFile: string | null = null

    try {
        const scriptOption = { ...ctx.parserOptions }
        if (ctx.isTypeScript() && scriptOption.filePath) {
            scriptOption.filePath += ".tsx"
            if (!fs.existsSync(scriptOption.filePath)) {
                fs.writeFileSync(
                    scriptOption.filePath,
                    "/* temp for astro-eslint-parser */",
                )
                removeFile = scriptOption.filePath
            }
        }
        const result =
            parser.parseForESLint?.(code, scriptOption) ??
            parser.parse?.(code, scriptOption)

        if ("ast" in result && result.ast != null) {
            return result
        }
        return { ast: result } as ESLintExtendedProgram
        // eslint-disable-next-line no-useless-catch -- for debug
    } catch (e) {
        throw e
    } finally {
        if (removeFile) fs.unlinkSync(removeFile)
    }
}
