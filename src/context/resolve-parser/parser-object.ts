import type { TSESTree } from "@typescript-eslint/types";
import type { ESLintExtendedProgram } from "../../types";
import type * as tsESLintParser from "@typescript-eslint/parser";
type TSESLintParser = typeof tsESLintParser;
/**
 * The type of basic ESLint custom parser.
 * e.g. espree
 */
export type BasicParserObject = {
  parse(code: string, options: any): TSESTree.Program;
  parseForESLint: undefined;
};
/**
 * The type of ESLint custom parser enhanced for ESLint.
 * e.g. @babel/eslint-parser, @typescript-eslint/parser
 */
export type EnhancedParserObject = {
  parseForESLint(code: string, options: any): ESLintExtendedProgram;
  parse: undefined;
};

/**
 * The type of ESLint (custom) parsers.
 */
export type ParserObject = EnhancedParserObject | BasicParserObject;

/** Checks whether given object is ParserObject */
export function isParserObject(value: unknown): value is ParserObject {
  return isEnhancedParserObject(value) || isBasicParserObject(value);
}
/** Checks whether given object is EnhancedParserObject */
export function isEnhancedParserObject(
  value: unknown,
): value is EnhancedParserObject {
  return Boolean(value && typeof (value as any).parseForESLint === "function");
}
/** Checks whether given object is BasicParserObject */
export function isBasicParserObject(
  value: unknown,
): value is BasicParserObject {
  return Boolean(value && typeof (value as any).parse === "function");
}

/** Checks whether given object is "@typescript-eslint/parser" */
export function maybeTSESLintParserObject(
  value: unknown,
): value is TSESLintParser {
  return (
    isEnhancedParserObject(value) &&
    isBasicParserObject(value) &&
    typeof (value as any).createProgram === "function" &&
    typeof (value as any).clearCaches === "function" &&
    typeof (value as any).version === "string"
  );
}

/** Get typescript parser name */
export function getTSParserNameFromObject(
  value: unknown,
):
  | "@typescript-eslint/parser"
  | "typescript-eslint-parser-for-extra-files"
  | null {
  if (!isEnhancedParserObject(value)) {
    return null;
  }
  if ((value as any).name === "typescript-eslint-parser-for-extra-files")
    return "typescript-eslint-parser-for-extra-files";
  if ((value as any).meta?.name === "typescript-eslint/parser")
    return "@typescript-eslint/parser";
  return null;
}

/** Checks whether given object is "@typescript-eslint/parser" */
export function isTSESLintParserObject(
  value: unknown,
): value is TSESLintParser {
  if (!isEnhancedParserObject(value)) return false;
  if ((value as any).name === "typescript-eslint-parser-for-extra-files")
    return true;
  if ((value as any).meta?.name === "typescript-eslint/parser") return true;
  try {
    const result = (value as unknown as TSESLintParser).parseForESLint("", {});
    const services = result.services;
    return Boolean(
      services &&
      services.esTreeNodeToTSNodeMap &&
      services.tsNodeToESTreeNodeMap &&
      services.program,
    );
  } catch {
    return false;
  }
}
