import type { Context } from "../context"
import { debug } from "../debug"
import type { ParserOptionsContext } from "../context/parser-options"
import type { ESLintExtendedProgram } from "../types"
import { patch } from "./ts-patch"
/**
 * Parse for script
 */
export function parseScript(
    code: string,
    _ctx: Context,
    parserOptions: ParserOptionsContext,
): ESLintExtendedProgram {
    const parser = parserOptions.getParser()

    let patchResult

    try {
        const scriptParserOptions = { ...parserOptions.parserOptions }
        if (
            parserOptions.isTypeScript() &&
            scriptParserOptions.filePath &&
            scriptParserOptions.project
        ) {
            patchResult = patch(scriptParserOptions)
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
        patchResult?.terminate()
    }
}
