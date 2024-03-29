import type { TSESTree } from "@typescript-eslint/types";
import type { ScopeManager } from "@typescript-eslint/scope-manager";
import type typescript from "typescript";
/**
 * The parsing result of ESLint custom parsers.
 */
export interface ESLintExtendedProgram {
  ast: TSESTree.Program;
  services?: Record<string, any>;
  visitorKeys?: { [type: string]: string[] };
  scopeManager?: ScopeManager;
}

/**
 * The interface of a result of ESLint custom parser.
 */
export type ESLintCustomParserResult =
  | ESLintExtendedProgram["ast"]
  | ESLintExtendedProgram;
export type { typescript };
export type TS = {
  ensureScriptKind?: (
    fileName: string,
    ...args: any[]
  ) => typescript.ScriptKind;
  getScriptKindFromFileName?: (
    fileName: string,
    ...args: any[]
  ) => typescript.ScriptKind;
} & typeof typescript;
