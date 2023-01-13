import { KEYS } from "../visitor-keys";
import type { Context } from "../context";
import type { AstroProgram } from "../ast";
import { AST_TOKEN_TYPES } from "@typescript-eslint/types";
import type { ScopeManager } from "eslint-scope";
import { parseScript } from "./script";
import { sort } from "./sort";
import type { ParseResult } from "@astrojs/compiler";
import { processTemplate } from "./process-template";
import { parseTemplate } from "./template";
import { ParserOptionsContext } from "../context/parser-options";
import type { ESLintExtendedProgram } from "../types";
import {
  addGlobalVariable,
  addVirtualReference,
  getProgramScope,
  removeAllScopeAndVariableAndReference,
  removeReferenceFromThrough,
} from "./scope";

/**
 * Parse source code
 */
export function parseForESLint(
  code: string,
  options?: any
): {
  ast: AstroProgram;
  services: Record<string, any> & {
    isAstro: true;
    getAstroAst: () => ParseResult["ast"];
    getAstroResult: () => ParseResult;
  };
  visitorKeys: { [type: string]: string[] };
  scopeManager: ScopeManager;
} {
  const { result: resultTemplate, context: ctx } = parseTemplate(
    code,
    options?.filePath ?? "<input>"
  );
  const scriptContext = processTemplate(ctx, resultTemplate);
  const parserOptions = new ParserOptionsContext(options);
  if (parserOptions.isTypeScript() && /\bAstro\b/u.test(code)) {
    scriptContext.appendVirtualScript(
      `declare const Astro: Readonly<import('astro').AstroGlobal<Props>>;`
    );
    scriptContext.restoreContext.addRestoreNodeProcess(
      (_scriptNode, { result }) => {
        const declareNode = result.ast.body.pop()!;
        const scopeManager = result.scopeManager;
        if (scopeManager) {
          // remove declare scope
          removeAllScopeAndVariableAndReference(declareNode, {
            visitorKeys: result.visitorKeys,
            scopeManager,
          });

          // analyze Props references
          const scope = getProgramScope(scopeManager);
          const propsVariable = scope.set.get("Props");
          if (propsVariable) {
            addVirtualReference(
              propsVariable.identifiers[0],
              propsVariable,
              scope,
              {
                read: true,
              }
            );
          }
          // analyze Astro, and Fragment references
          const astroGlobalReferences = scope.through.filter(
            (ref) =>
              ref.identifier.name === "Astro" ||
              ref.identifier.name === "Fragment"
          );
          for (const astroGlobalReference of astroGlobalReferences) {
            addGlobalVariable(astroGlobalReference, scopeManager);
            removeReferenceFromThrough(astroGlobalReference, scope);
          }
        }
        return true;
      }
    );
  }

  const resultScript = parseScript(scriptContext.script, ctx, parserOptions);

  scriptContext.restoreContext.restore(resultScript);
  sort(resultScript.ast.comments!);
  sort(resultScript.ast.tokens!);
  extractTokens(resultScript, ctx);

  resultScript.services = Object.assign(resultScript.services || {}, {
    isAstro: true,
    getAstroAst() {
      return resultTemplate.ast;
    },
    getAstroResult() {
      return resultTemplate;
    },
  });
  resultScript.visitorKeys = Object.assign({}, KEYS, resultScript.visitorKeys);

  return resultScript as any;
}

/** Extract tokens */
export function extractTokens(ast: ESLintExtendedProgram, ctx: Context): void {
  if (!ast.ast.tokens) {
    return;
  }
  const useRanges = sort([...ast.ast.tokens, ...(ast.ast.comments || [])]).map(
    (t) => t.range
  );
  let range = useRanges.shift();
  for (let index = 0; index < ctx.code.length; index++) {
    while (range && range[1] <= index) {
      range = useRanges.shift();
    }
    if (range && range[0] <= index) {
      index = range[1] - 1;
      continue;
    }
    const c = ctx.code[index];
    if (!c.trim()) {
      continue;
    }
    if (isPunctuator(c)) {
      ast.ast.tokens.push(
        ctx.buildToken(AST_TOKEN_TYPES.Punctuator, [index, index + 1])
      );
    } else {
      // unknown
      // It is may be a bug.
      ast.ast.tokens.push(
        ctx.buildToken(AST_TOKEN_TYPES.Identifier, [index, index + 1])
      );
    }
  }
  sort(ast.ast.tokens);

  /**
   * Checks if the given char is punctuator
   */
  function isPunctuator(c: string) {
    return /^[^\w$]$/iu.test(c);
  }
}
