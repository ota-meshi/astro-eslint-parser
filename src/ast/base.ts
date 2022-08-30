import type { TSESTree } from "@typescript-eslint/types";

export interface BaseNode {
  loc: TSESTree.SourceLocation;
  range: TSESTree.Range;
  type: string;
}
