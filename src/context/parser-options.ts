import path from "path";
import fs from "fs";
import { getParser, getParserForLang } from "./resolve-parser";
import type { ParserObject } from "./resolve-parser/parser-object";
import { isTSESLintParserObject } from "./resolve-parser/parser-object";
import { maybeTSESLintParserObject } from "./resolve-parser/parser-object";

const TS_PARSER_NAMES = [
  "@typescript-eslint/parser",
  "typescript-eslint-parser-for-extra-files",
];

export class ParserOptionsContext {
  public readonly parserOptions: any;

  private readonly state: { isTypeScript?: boolean; originalAST?: any } = {};

  public constructor(options: any) {
    const parserOptions = {
      ecmaVersion: 2020,
      sourceType: "module",
      loc: true,
      range: true,
      raw: true,
      tokens: true,
      comment: true,
      eslintVisitorKeys: true,
      eslintScopeManager: true,
      ...(options || {}),
    };
    parserOptions.ecmaFeatures = {
      ...(parserOptions.ecmaFeatures || {}),
      jsx: true,
    };
    parserOptions.sourceType = "module";
    if (parserOptions.ecmaVersion <= 5 || parserOptions.ecmaVersion == null) {
      parserOptions.ecmaVersion = 2015;
    }
    this.parserOptions = parserOptions;
  }

  public getParser(): ParserObject {
    return getParser({}, this.parserOptions.parser);
  }

  public isTypeScript(): boolean {
    if (this.state.isTypeScript != null) {
      return this.state.isTypeScript;
    }
    const parserValue = getParserForLang({}, this.parserOptions?.parser);
    if (typeof parserValue !== "string") {
      return (this.state.isTypeScript =
        maybeTSESLintParserObject(parserValue) ||
        isTSESLintParserObject(parserValue));
    }

    const parserName = parserValue;
    if (TS_PARSER_NAMES.includes(parserName)) {
      return (this.state.isTypeScript = true);
    }
    if (TS_PARSER_NAMES.some((nm) => parserName.includes(nm))) {
      let targetPath = parserName;
      while (targetPath) {
        const pkgPath = path.join(targetPath, "package.json");
        if (fs.existsSync(pkgPath)) {
          try {
            return (this.state.isTypeScript = TS_PARSER_NAMES.includes(
              JSON.parse(fs.readFileSync(pkgPath, "utf-8"))?.name
            ));
          } catch {
            return (this.state.isTypeScript = false);
          }
        }
        const parent = path.dirname(targetPath);
        if (targetPath === parent) {
          break;
        }
        targetPath = parent;
      }
    }

    return (this.state.isTypeScript = false);
  }
}
