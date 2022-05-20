import type { TSESTree } from "@typescript-eslint/types"
import type { ScopeManager } from "eslint-scope"
/**
 * The parsing result of ESLint custom parsers.
 */
export interface ESLintExtendedProgram {
    ast: TSESTree.Program
    services?: Record<string, any>
    visitorKeys?: { [type: string]: string[] }
    scopeManager?: ScopeManager
}

/**
 * The interface of a result of ESLint custom parser.
 */
export type ESLintCustomParserResult =
    | ESLintExtendedProgram["ast"]
    | ESLintExtendedProgram
//
// The interface of ESLint custom parsers.
//
export interface ESLintCustomParser {
    parse(code: string, options: any): ESLintCustomParserResult
    parseForESLint?(code: string, options: any): ESLintCustomParserResult
}
