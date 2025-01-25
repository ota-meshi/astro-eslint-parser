import { Linter } from "eslint";
import assert from "assert";
import fs from "fs";
import * as parser from "../../../src/index";
import {
  getBasicParserOptions,
  getMessageData,
  listupFixtures,
} from "./test-utils";
import globals from "globals";

function createLinter() {
  const linter = new Linter({ configType: "flat" });
  return linter;
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

const RULES = [
  "no-unused-labels",
  "no-extra-label",
  "no-undef",
  "no-unused-vars",
  "no-unused-expressions",
  "space-infix-ops",
  "no-setter-return",
  "no-import-assign",
  "prefer-const",
  "spaced-comment",
  "no-redeclare",
  "template-curly-spacing",
  "semi",
];

describe("astro-eslint-parser with ESLint rules", () => {
  for (const {
    input,
    inputFileName,
    getRuleOutputFileName,
  } of listupFixtures()) {
    const linter = createLinter();
    describe(inputFileName, () => {
      for (const rule of RULES) {
        it(rule, () => {
          const outputFileName = getRuleOutputFileName(rule);
          const messages = linter.verify(
            input,
            {
              files: ["**"],
              languageOptions: {
                parser,
                parserOptions: getBasicParserOptions(inputFileName),
                globals: { ...globals.browser },
              },
              rules: {
                [rule]: "error",
              },
            },
            inputFileName,
          );

          if (messages.length === 0) {
            assert.strictEqual(
              fs.existsSync(outputFileName),
              false,
              "Expected empty messages",
            );
          } else {
            const messagesJson = JSON.stringify(
              messages.map((m) => {
                return getMessageData(input, m);
              }),
              null,
              2,
            );
            const output = fs.existsSync(outputFileName)
              ? fs.readFileSync(outputFileName, "utf8")
              : "";
            assert.strictEqual(messagesJson, output);
          }
        });
      }
    });
  }
});
