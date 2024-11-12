import type { Context } from "../context";
import { debug } from "../debug";
import type {
  ParserOptions,
  ParserOptionsContext,
} from "../context/parser-options";
import type { ESLintExtendedProgram } from "../types";
import { tsPatch } from "./ts-patch";
import { isEnhancedParserObject } from "../context/resolve-parser/parser-object";
import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/types";
import type {
  ScopeManager as TSESLintScopeManager,
  Scope,
} from "@typescript-eslint/scope-manager";
import {
  analyze as analyzeForTypeScript,
  Reference,
} from "@typescript-eslint/scope-manager";
import type { AnalysisOptions } from "eslint-scope";
import {
  // @ts-expect-error -- Missing type
  Referencer as BaseReferencer,
  ScopeManager,
} from "eslint-scope";
import { KEYS } from "../visitor-keys";
import { getKeys } from "../traverse";
import { READ_FLAG, REFERENCE_TYPE_VALUE_FLAG } from "./scope";
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
    // @ts-expect-error -- Type bug?
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
        { ...parserOptions, project: true },
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

declare class BaseReferencer {
  public constructor(options: AnalysisOptions, scopeManager: ScopeManager);

  protected currentScope(): Scope;

  protected currentScope(throwOnNull: true): Scope | null;

  public visit(node: TSESTree.Node | null | undefined): void;

  protected visitChildren<T extends TSESTree.Node>(
    node: T | null | undefined,
    excludeArr?: (keyof T)[],
  ): void;
}

class Referencer extends BaseReferencer {
  protected JSXAttribute(node: TSESTree.JSXAttribute) {
    this.visit(node.value);
  }

  protected JSXClosingElement() {
    // should not visit children
  }

  protected JSXFragment(node: TSESTree.JSXFragment) {
    this.visitChildren(node);
  }

  protected JSXIdentifier(node: TSESTree.JSXIdentifier) {
    const scope = this.currentScope();

    const ref = new Reference(
      node,
      scope,
      READ_FLAG,
      undefined,
      undefined,
      false,
      REFERENCE_TYPE_VALUE_FLAG,
    );

    scope.references.push(ref);

    // @ts-expect-error -- Internal property
    scope.__left.push(ref);
  }

  protected JSXMemberExpression(node: TSESTree.JSXMemberExpression) {
    if (node.object.type !== AST_NODE_TYPES.JSXIdentifier) {
      this.visit(node.object);
    } else {
      if (node.object.name !== "this") {
        this.visit(node.object);
      }
    }
  }

  protected JSXOpeningElement(node: TSESTree.JSXOpeningElement) {
    if (node.name.type === AST_NODE_TYPES.JSXIdentifier) {
      if (
        node.name.name[0].toUpperCase() === node.name.name[0] ||
        node.name.name === "this"
      ) {
        this.visit(node.name);
      }
    } else {
      this.visit(node.name);
    }
    for (const attr of node.attributes) {
      this.visit(attr);
    }
  }
}

/**
 * Analyzed scopes for JavaScript.
 */
function analyzeForEcmaScript(
  tree: TSESTree.Program,
  providedOptions: AnalysisOptions,
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
    },
    providedOptions,
  );
  const scopeManager = new ScopeManager(
    // @ts-expect-error -- No typings
    options,
  );
  const referencer = new Referencer(options, scopeManager);

  referencer.visit(tree);

  return scopeManager as never;
}
