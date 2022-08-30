/* global require -- node */
import { Linter } from "eslint";
import assert from "assert";
import fs from "fs";
import * as parser from "../../src";
import {
  getBasicParserOptions,
  getMessageData,
  listupFixtures,
} from "./parser/test-utils";
import path from "path";

const FIXTURE_ROOT = path.resolve(__dirname, "../fixtures/integrations");

function createLinter() {
  const linter = new Linter();

  linter.defineParser("astro-eslint-parser", parser as any);

  return linter;
}

describe("Integration tests.", () => {
  for (const { input, inputFileName, outputFileName } of listupFixtures(
    FIXTURE_ROOT
  )) {
    it(inputFileName, () => {
      const setupFileName = inputFileName.replace(/input\.astro$/u, "setup.ts");
      const fixedOutputFileName = inputFileName.replace(
        /input\.astro$/u,
        "output.astro"
      );
      const setup = fs.existsSync(setupFileName)
        ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- test
          require(setupFileName)
        : null;
      const linter = createLinter();
      setup?.setupLinter?.(linter);
      const messages = linter.verify(
        input,
        setup?.getConfig?.() ?? {
          parser: "astro-eslint-parser",
          parserOptions: getBasicParserOptions(),
          env: {
            browser: true,
            es2021: true,
          },
        },
        inputFileName
      );
      const messagesJson = JSON.stringify(
        messages.map((m) => {
          return {
            ...getMessageData(input, m),
            message: m.message,
          };
        }),
        null,
        2
      );

      if (fs.existsSync(outputFileName)) {
        const output = fs.readFileSync(outputFileName, "utf8");
        assert.strictEqual(messagesJson, output);
      } else {
        fs.writeFileSync(outputFileName, messagesJson, "utf8");
      }
      const { output } = linter.verifyAndFix(
        input,
        setup?.getConfig?.() ?? {
          parser: "astro-eslint-parser",
          parserOptions: getBasicParserOptions(),
          env: {
            browser: true,
            es2021: true,
          },
        },
        inputFileName
      );
      if (input !== output) {
        if (fs.existsSync(fixedOutputFileName)) {
          const fixed = fs.readFileSync(fixedOutputFileName, "utf8");
          assert.strictEqual(output, fixed);
        } else {
          fs.writeFileSync(fixedOutputFileName, output, "utf8");
        }
      } else {
        if (fs.existsSync(fixedOutputFileName)) {
          fs.unlinkSync(fixedOutputFileName);
        }
      }
    });
  }
});
