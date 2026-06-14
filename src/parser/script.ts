import type { Context } from "../context";
import { debug } from "../debug";
import type {
  ParserOptions,
  ParserOptionsContext,
} from "../context/parser-options";
import type { ESLintExtendedProgram } from "../types";
import { tsPatch } from "./ts-patch";
import { isEnhancedParserObject } from "../context/resolve-parser/parser-object";
import type { TSESTree } from "@typescript-eslint/types";
import type { ScopeManager as TSESLintScopeManager } from "@typescript-eslint/scope-manager";
import { analyze as analyzeForTypeScript } from "@typescript-eslint/scope-manager";
import type { AnalyzeOptions } from "eslint-scope";
import { KEYS } from "../visitor-keys";
import { getKeys } from "../traverse";
import { getEslintScope } from "./eslint-scope";

const eslintScope = getEslintScope();
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
): TSESLintScopeManager {
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
    childVisitorKeys: result.visitorKeys || KEYS,
    fallback: getKeys,
  });
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
    } else if (
      parserOptionsCtx.isTypeScript() &&
      parserOptions.filePath &&
      parserOptions.projectService
    ) {
      console.warn(
        "`astro-eslint-parser` does not support the `projectService` option, it will parse it as `project: true` instead.",
      );
      patchResult = tsPatch(
        { ...parserOptions, project: true, projectService: undefined },
        parserOptionsCtx.getTSParserName()!,
      );
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

/**
 * Analyzed scopes for JavaScript.
 */
function analyzeForEcmaScript(
  tree: TSESTree.Program,
  providedOptions: AnalyzeOptions,
): TSESLintScopeManager {
  const options = Object.assign(
    {
      optimistic: false,
      nodejsScope: false,
      impliedStrict: false,
      sourceType: "script", // one of ['script', 'module', 'commonjs']
      ecmaVersion: 5,
      childVisitorKeys: null,
      fallback: "iteration",
      jsx: true,
    },
    providedOptions,
  );
  const scopeManager = eslintScope.analyze(tree as never, options);

  return scopeManager as never;
}
