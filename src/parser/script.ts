import type { Context } from "../context";
import { debug } from "../debug";
import type { ParserOptionsContext } from "../context/parser-options";
import type { ESLintExtendedProgram } from "../types";
import { tsPatch } from "./ts-patch";
import { isEnhancedParserObject } from "../context/resolve-parser/parser-object";
import { analyze } from "@typescript-eslint/scope-manager";
/**
 * Parse for script
 */
export function parseScript(
  code: string,
  ctx: Context,
  parserOptionsCtx: ParserOptionsContext
): ESLintExtendedProgram {
  const result = parseScriptInternal(code, ctx, parserOptionsCtx);

  const parserOptions = parserOptionsCtx.parserOptions;
  if (!result.scopeManager && parserOptions.eslintScopeManager) {
    result.scopeManager = analyze(result.ast, {
      ecmaVersion: 1e8,
      globalReturn: parserOptions.ecmaFeatures?.globalReturn,
      jsxPragma: parserOptions.jsxPragma,
      jsxFragmentName: parserOptions.jsxFragmentName,
      lib: parserOptions.lib,
      sourceType: parserOptions.sourceType,
    });
  }

  return result;
}

/**
 * Parse for script
 */
function parseScriptInternal(
  code: string,
  _ctx: Context,
  parserOptionsCtx: ParserOptionsContext
): ESLintExtendedProgram {
  const parser = parserOptionsCtx.getParser();

  let patchResult;

  try {
    const parserOptions = parserOptionsCtx.parserOptions;
    if (
      parserOptionsCtx.isTypeScript() &&
      parserOptions.filePath &&
      parserOptions.project
    ) {
      patchResult = tsPatch(parserOptions);
    }
    const result = isEnhancedParserObject(parser)
      ? parser.parseForESLint(code, parserOptions)
      : parser.parse(code, parserOptions);

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
