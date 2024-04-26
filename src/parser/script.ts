import type { Context } from "../context";
import { debug } from "../debug";
import type {
  ParserOptions,
  ParserOptionsContext,
} from "../context/parser-options";
import type { ESLintExtendedProgram } from "../types";
import { tsPatch } from "./ts-patch";
import { isEnhancedParserObject } from "../context/resolve-parser/parser-object";
import type { ScopeManager } from "@typescript-eslint/scope-manager";
import { analyze as analyzeForTypeScript } from "@typescript-eslint/scope-manager";
import { analyze as analyzeForEcmaScript } from "eslint-scope";
import { KEYS } from "../visitor-keys";
import { getKeys } from "../traverse";
/**
 * Parse for script
 */
export function parseScript(
  code: string,
  ctx: Context,
  parserOptionsCtx: ParserOptionsContext,
): ESLintExtendedProgram {
  const result = parseScriptInternal(code, ctx, parserOptionsCtx);

  const parserOptions = parserOptionsCtx.parserOptions;
  if (!result.scopeManager && parserOptions.eslintScopeManager) {
    result.scopeManager = analyzeScope(result, parserOptions);
  }

  return result;
}

/**
 * Analyze scope
 */
function analyzeScope(
  result: ESLintExtendedProgram,
  parserOptions: ParserOptions,
): ScopeManager {
  try {
    return analyzeForTypeScript(result.ast, {
      globalReturn: parserOptions.ecmaFeatures?.globalReturn,
      jsxPragma: parserOptions.jsxPragma,
      jsxFragmentName: parserOptions.jsxFragmentName,
      lib: parserOptions.lib,
      sourceType: parserOptions.sourceType,
    });
  } catch {
    // ignore
  }
  const ecmaFeatures = parserOptions.ecmaFeatures || {};

  return analyzeForEcmaScript(result.ast, {
    ignoreEval: true,
    nodejsScope: ecmaFeatures.globalReturn,
    impliedStrict: ecmaFeatures.impliedStrict as never,
    ecmaVersion: 1e8,
    sourceType:
      parserOptions.sourceType === "commonjs"
        ? "script"
        : parserOptions.sourceType || "script",
    // @ts-expect-error -- Type bug?
    childVisitorKeys: result.visitorKeys || KEYS,
    fallback: getKeys,
  }) as ScopeManager;
}

/**
 * Parse for script
 */
function parseScriptInternal(
  code: string,
  _ctx: Context,
  parserOptionsCtx: ParserOptionsContext,
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
      patchResult = tsPatch(parserOptions, parserOptionsCtx.getTSParserName()!);
    }
    const result = isEnhancedParserObject(parser)
      ? patchResult?.parse
        ? patchResult.parse(code, parser)
        : parser.parseForESLint(code, parserOptions)
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

${code}`,
    );
    throw e;
  } finally {
    patchResult?.terminate();
  }
}
