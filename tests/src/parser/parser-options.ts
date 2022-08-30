import type { TSESTree } from "@typescript-eslint/types";
import assert from "assert";
import { parseForESLint } from "../../../src";
import * as tsParser from "@typescript-eslint/parser";

const CODE = `---
a<b|c>(d);
---`;

function parse(code: string, options: any) {
  return parseForESLint(code, options).ast;
}

describe("parser options", () => {
  describe("parserOptions.parser", () => {
    it("should work without parser.", () => {
      const ast = parse(CODE, {});

      const st = ast.body[0] as TSESTree.ExpressionStatement;
      assert.strictEqual(st.expression.type, "BinaryExpression");
    });
    it("should work with parser name.", () => {
      const ast = parse(CODE, {
        parser: "@typescript-eslint/parser",
      });

      const st = ast.body[0] as TSESTree.ExpressionStatement;
      assert.strictEqual(st.expression.type, "CallExpression");
    });
    it("should work with single parser object.", () => {
      const ast = parse(CODE, {
        parser: tsParser,
      });

      const st = ast.body[0] as TSESTree.ExpressionStatement;
      assert.strictEqual(st.expression.type, "CallExpression");
    });
  });
});
