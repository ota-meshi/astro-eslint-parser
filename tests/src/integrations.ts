import { Linter } from "eslint";
import assert from "assert";
import fs from "fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as parser from "../../src";
import {
  getBasicParserOptions,
  getMessageData,
  listupFixtures,
} from "./parser/test-utils";
import path from "path";
import globals from "globals";

const require = createRequire(import.meta.url);
const dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(dirname, "../fixtures/integrations");

function createLinter() {
  const linter = new Linter({ configType: "flat" });
  return linter;
}

describe("Integration tests.", () => {
  for (const { input, inputFileName, outputFileName } of listupFixtures(
    FIXTURE_ROOT,
  )) {
    it(inputFileName, () => {
      const setupFileName = inputFileName.replace(/input\.astro$/u, "setup.ts");
      const fixedOutputFileName = inputFileName.replace(
        /input\.astro$/u,
        "output.astro",
      );
      const setup = fs.existsSync(setupFileName)
        ? require(setupFileName)
        : null;
      const linter = createLinter();
      const messages = linter.verify(
        input,
        {
          files: ["**"],
          ...(setup?.getConfig?.() ?? {
            languageOptions: {
              ecmaVersion: "latest",
              sourceType: "module",
              parser,
              parserOptions: getBasicParserOptions(),
              globals: { ...globals.browser },
            },
          }),
        },
        inputFileName,
      );
      const messagesJson = JSON.stringify(
        messages.map((m) => {
          return {
            ...getMessageData(input, m),
            message: m.message,
          };
        }),
        null,
        2,
      );

      if (fs.existsSync(outputFileName)) {
        const output = fs.readFileSync(outputFileName, "utf8");
        assert.strictEqual(messagesJson, output);
      } else {
        fs.writeFileSync(outputFileName, messagesJson, "utf8");
      }
      const { output } = linter.verifyAndFix(
        input,
        {
          files: ["**"],
          ...(setup?.getConfig?.() ?? {
            languageOptions: {
              ecmaVersion: "latest",
              sourceType: "module",
              parser,
              parserOptions: getBasicParserOptions(),
              globals: { ...globals.browser },
            },
          }),
        },
        inputFileName,
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
