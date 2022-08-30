export * from "./astro";
export * from "./jsx";
import type { TSESTree } from "@typescript-eslint/types";
export type Comment = TSESTree.Comment;
export type Token = TSESTree.Token;
export type SourceLocation = TSESTree.SourceLocation;
export type Range = TSESTree.Range;
export type Position = TSESTree.Position;
