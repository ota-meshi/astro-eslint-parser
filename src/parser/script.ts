import type { Context } from "../context";
import { debug } from "../debug";
import type { ParserOptionsContext } from "../context/parser-options";
import type { ESLintExtendedProgram } from "../types";
import { tsPatch } from "./ts-patch";
import type { ParserOptions } from "@typescript-eslint/types";
import { isEnhancedParserObject } from "../context/resolve-parser/parser-object";
/**
 * Parse for script
 */
export function parseScript(
  code: string,
  _ctx: Context,
  parserOptions: ParserOptionsContext
): ESLintExtendedProgram {
  const parser = parserOptions.getParser();

  let patchResult;

  try {
    const scriptParserOptions: ParserOptions = {
      ...parserOptions.parserOptions,
    };
    scriptParserOptions.ecmaFeatures = {
      ...(scriptParserOptions.ecmaFeatures || {}),
      jsx: true,
    };
    if (
      parserOptions.isTypeScript() &&
      scriptParserOptions.filePath &&
      scriptParserOptions.project
    ) {
      patchResult = tsPatch(scriptParserOptions);
    }
    const result = isEnhancedParserObject(parser)
      ? parser.parseForESLint(code, scriptParserOptions)
      : parser.parse(code, scriptParserOptions);

    if ("ast" in result && result.ast != null) {
      return result;
    }
    return { ast: result } as ESLintExtendedProgram;
  } catch (e) {
    debug(
      "[script] parsing error:",
      (e as any).message,
      `@ ${JSON.stringify(code)}

${code}`
    );
    throw e;
  } finally {
    patchResult?.terminate();
  }
}
