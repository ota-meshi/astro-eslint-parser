import type { Rule } from "eslint";
import { Linter } from "eslint";
import assert from "assert";
import * as parser from "../../../src/index";
import { getBasicParserOptions } from "./test-utils";
import globals from "globals";

function createLinter() {
  const linter = new Linter({ configType: "flat" });
  return linter;
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("eslint custom parser", () => {
  it("should work with eslint.", () => {
    const code = `<h1>Hello!</h1>`;

    const linter = createLinter();
    const testRule: Rule.RuleModule = {
      create(context) {
        return {
          JSXElement(node: any) {
            context.report({
              node,
              message: "test",
            });
          },
        };
      },
    };
    const messages = linter.verify(code, {
      files: ["**"],
      plugins: {
        test: { rules: { test: testRule } },
      },
      languageOptions: {
        parser,
      },
      rules: {
        "test/test": "error",
      },
    });

    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].message, "test");
  });

  describe("should work with eslint core rule.", () => {
    const tests: {
      code: string;
      output: string | null;
      messages: {
        ruleId: string;
        line: number;
        column: number;
      }[];
    }[] = [
      {
        code: `
                ---
                let a=1;
                let b=2;
                let c=3;
                ---
                <input type="number" value={a}>
                <input type="number" value={b}>
                <p>{a}+{b}={a+b}</p>
                `,
        output: `
                ---
                let a = 1;
                let b = 2;
                let c = 3;
                ---
                <input type="number" value={a}>
                <input type="number" value={b}>
                <p>{a}+{b}={a + b}</p>
                `,
        messages: [
          {
            ruleId: "no-unused-vars",
            line: 5,
            column: 21,
          },
        ],
      },
    ];

    for (const { code, output, messages } of tests) {
      it(code, () => {
        const linter = createLinter();
        const result = linter.verifyAndFix(code, {
          files: ["**"],
          languageOptions: {
            parser,
            parserOptions: {
              ...getBasicParserOptions(),
              parser: "espree",
              globals: { ...globals.browser },
            },
          },
          rules: {
            "no-unused-labels": "error",
            "no-extra-label": "error",
            "no-undef": "error",
            "no-unused-vars": "error",
            "no-unused-expressions": "error",
            "space-infix-ops": "error",
          },
        });

        assert.deepStrictEqual(
          result.messages.map((m) => {
            return {
              ruleId: m.ruleId,
              line: m.line,
              column: m.column,
            };
          }),
          messages,
        );

        assert.strictEqual(result.output, output ?? code);
      });
    }
  });
});
