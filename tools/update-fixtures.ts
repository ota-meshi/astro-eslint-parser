import fs from "fs";
import path from "path";
import { Linter } from "eslint";
import * as parser from "../src/index";
import { parseForESLint } from "../src/index";
import {
  buildTypes,
  getBasicParserOptions,
  getMessageData,
  listupFixtures,
  nodeReplacer,
  normalizeError,
  scopeToJSON,
} from "../tests/src/parser/test-utils";

const ERROR_FIXTURE_ROOT = path.resolve(
  __dirname,
  "../tests/fixtures/parser/error",
);

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

/**
 * Parse
 */
function parse(code: string, filePath: string) {
  return parseForESLint(code, {
    ...getBasicParserOptions(filePath),
    filePath,
  });
}

for (const {
  input,
  inputFileName,
  outputFileName,
  scopeFileName,
  typeFileName,
  getRuleOutputFileName,
} of listupFixtures()) {
  // if (!inputFileName.includes("test-file")) continue;
  try {
    // eslint-disable-next-line no-console -- ignore
    console.log(inputFileName);
    const result = parse(input, inputFileName);
    const astJson = JSON.stringify(result.ast, nodeReplacer, 2);
    fs.writeFileSync(outputFileName, astJson, "utf8");
    const scopeJson = result.scopeManager
      ? scopeToJSON(result.scopeManager)
      : "null";
    fs.writeFileSync(scopeFileName, scopeJson, "utf8");

    if (typeFileName) {
      fs.writeFileSync(typeFileName, buildTypes(input, result), "utf8");
    }
  } catch (e) {
    // eslint-disable-next-line no-console -- ignore
    console.error(e);
    throw e;
  }

  const linter = createLinter();
  for (const rule of RULES) {
    const ruleOutputFileName = getRuleOutputFileName(rule);
    const messages = linter.verify(
      input,
      {
        parser: "astro-eslint-parser",
        parserOptions: getBasicParserOptions(inputFileName),
        rules: {
          [rule]: "error",
        },
        env: {
          browser: true,
          es2021: true,
        },
      },
      inputFileName,
    );

    if (messages.length === 0) {
      if (fs.existsSync(ruleOutputFileName)) fs.unlinkSync(ruleOutputFileName);
    } else {
      const messagesJson = JSON.stringify(
        messages.map((m) => {
          return getMessageData(input, m);
        }),
        null,
        2,
      );
      fs.writeFileSync(ruleOutputFileName, messagesJson, "utf8");
    }
  }
}

for (const { input, inputFileName, outputFileName } of listupFixtures(
  ERROR_FIXTURE_ROOT,
)) {
  // eslint-disable-next-line no-console -- ignore
  console.log(inputFileName);
  try {
    parse(input, inputFileName);
  } catch (e) {
    const errorJson = JSON.stringify(normalizeError(e), nodeReplacer, 2);
    fs.writeFileSync(outputFileName, errorJson, "utf8");
  }
}

// eslint-disable-next-line jsdoc/require-jsdoc -- X
function createLinter() {
  const linter = new Linter();

  linter.defineParser("astro-eslint-parser", parser as any);

  return linter;
}
