import path from "path";
import fs from "fs";
import { getParser, getParserForLang } from "./resolve-parser";
import type { ParserObject } from "./resolve-parser/parser-object";
import { getTSParserNameFromObject } from "./resolve-parser/parser-object";
import { isTSESLintParserObject } from "./resolve-parser/parser-object";
import { maybeTSESLintParserObject } from "./resolve-parser/parser-object";
import type { ParserOptions as CommonParserOptions } from "@typescript-eslint/types";

export type UserOptionParser =
  | string
  | ParserObject
  | Record<string, string | ParserObject | undefined>
  | undefined;
export type ParserOptions = CommonParserOptions & { parser?: UserOptionParser };

export type TSParserName =
  | "@typescript-eslint/parser"
  | "typescript-eslint-parser-for-extra-files"
  | "$unknown$";

const TS_PARSER_NAMES = [
  "@typescript-eslint/parser",
  "typescript-eslint-parser-for-extra-files",
];

export class ParserOptionsContext {
  public readonly parserOptions: ParserOptions;

  private readonly state: {
    ts?: { parserName: TSParserName } | false;
    originalAST?: any;
  } = {};

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
      // eslintScopeManager: true,
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

  public getTSParserName(): TSParserName | null {
    if (this.state.ts != null) {
      return this.state.ts === false ? null : this.state.ts.parserName;
    }
    const parserValue = getParserForLang({}, this.parserOptions?.parser);
    if (typeof parserValue !== "string") {
      const name = getTSParserNameFromObject(parserValue);
      if (name) {
        this.state.ts = { parserName: name };
        return this.state.ts.parserName;
      }
      if (
        maybeTSESLintParserObject(parserValue) ||
        isTSESLintParserObject(parserValue)
      ) {
        this.state.ts = { parserName: "$unknown$" };
        return this.state.ts.parserName;
      }
      this.state.ts = false;
      return null;
    }

    const parserName = parserValue;
    if (TS_PARSER_NAMES.includes(parserName)) {
      this.state.ts = { parserName: parserName as TSParserName };
      return this.state.ts.parserName;
    }
    if (TS_PARSER_NAMES.some((nm) => parserName.includes(nm))) {
      let targetPath = parserName;
      while (targetPath) {
        const pkgPath = path.join(targetPath, "package.json");
        if (fs.existsSync(pkgPath)) {
          try {
            const pkgName = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))?.name;
            if (TS_PARSER_NAMES.includes(pkgName)) {
              this.state.ts = { parserName: pkgName as TSParserName };
              return this.state.ts.parserName;
            }
            this.state.ts = false;
            return null;
          } catch {
            this.state.ts = false;
            return null;
          }
        }
        const parent = path.dirname(targetPath);
        if (targetPath === parent) {
          break;
        }
        targetPath = parent;
      }
    }

    this.state.ts = false;
    return null;
  }

  public isTypeScript(): boolean {
    return Boolean(this.getTSParserName());
  }
}
