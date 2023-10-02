/* global require -- node */
import path from "path";
import fs from "fs";
import semver from "semver";
import type { Linter } from "eslint";
import * as globals from "globals";
import type { TSESTree } from "@typescript-eslint/types";
import { LinesAndColumns } from "../../../src/context";
import type {
  Reference,
  Scope,
  ScopeManager,
  Variable,
  Definition,
} from "@typescript-eslint/scope-manager";
import type { AstroNode } from "../../../src/ast";
import { TS_GLOBALS } from "./ts-vars";

const AST_FIXTURE_ROOT = path.resolve(__dirname, "../../fixtures/parser/ast");
export function getBasicParserOptions(
  filePath = "<input>",
): Linter.BaseConfig["parserOptions"] {
  let parser = "@typescript-eslint/parser";

  if (path.basename(filePath).startsWith("js-")) {
    parser = "espree";
  }
  return {
    ecmaVersion: 2020,
    parser,
    project: require.resolve("../../fixtures/tsconfig.test.json"),
    extraFileExtensions: [".astro", ".md"],
    sourceType: "module",
  };
}

export function* listupFixtures(dir?: string): IterableIterator<{
  input: string;
  inputFileName: string;
  outputFileName: string;
  scopeFileName: string;
  typeFileName: string | null;
  requirements: {
    scope?: Record<string, string>;
  };
  getRuleOutputFileName: (ruleName: string) => string;
  meetRequirements: (key: "test" | "scope") => boolean;
}> {
  yield* listupFixturesImpl(dir || AST_FIXTURE_ROOT);
}

function* listupFixturesImpl(dir: string): IterableIterator<{
  input: string;
  inputFileName: string;
  outputFileName: string;
  scopeFileName: string;
  typeFileName: string | null;
  requirements: {
    scope?: Record<string, string>;
  };
  getRuleOutputFileName: (ruleName: string) => string;
  meetRequirements: (key: "test" | "scope") => boolean;
}> {
  for (const filename of fs.readdirSync(dir)) {
    if (filename === "omit-end-tag-input.astro") {
      // FIXME The astro parser used to parse well, but since 0.26.1 it no longer parses well.
      continue;
    }
    const inputFileName = path.join(dir, filename);
    if (filename.endsWith("input.astro") || filename.endsWith("input.md")) {
      const outputFileName = inputFileName.replace(
        /input\.[a-z]+$/u,
        "output.json",
      );
      const scopeFileName = inputFileName.replace(
        /input\.[a-z]+$/u,
        "scope-output.json",
      );
      const typeFileName = inputFileName.replace(
        /input\.([a-z]+)$/u,
        "type-output.$1",
      );
      const requirementsFileName = inputFileName.replace(
        /input\.[a-z]+$/u,
        "requirements.json",
      );

      const input = fs.readFileSync(inputFileName, "utf8");
      const requirements = fs.existsSync(requirementsFileName)
        ? JSON.parse(fs.readFileSync(requirementsFileName, "utf-8"))
        : {};
      yield {
        input,
        inputFileName,
        outputFileName,
        scopeFileName,
        typeFileName: fs.existsSync(typeFileName) ? typeFileName : null,
        requirements,
        getRuleOutputFileName: (ruleName) => {
          return inputFileName.replace(
            /input\.[a-z]+$/u,
            `${ruleName}-result.json`,
          );
        },
        meetRequirements(key) {
          const obj = requirements[key];
          if (obj) {
            if (
              Object.entries(obj).some(([pkgName, pkgVersion]) => {
                // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- ignore
                const pkg = require(`${pkgName}/package.json`);
                return !semver.satisfies(pkg.version, pkgVersion as string);
              })
            ) {
              return false;
            }
          }
          return true;
        },
      };
    }
    if (
      fs.existsSync(inputFileName) &&
      fs.statSync(inputFileName).isDirectory()
    ) {
      yield* listupFixturesImpl(inputFileName);
    }
  }
}

export function getMessageData(
  code: string,
  message: Linter.LintMessage,
): {
  ruleId: string | null;
  code: string;
  message?: string;
  line: number;
  column: number;
} {
  const linesAndColumns = new LinesAndColumns(code);
  const start = linesAndColumns.getIndexFromLoc({
    line: message.line,
    column: message.column - 1,
  });
  let end: number;
  if (message.endLine != null) {
    end = linesAndColumns.getIndexFromLoc({
      line: message.endLine,
      column: message.endColumn! - 1,
    });
  } else {
    end = start + 1;
  }
  if (message.ruleId == null) {
    return {
      ruleId: message.ruleId,
      message: message.message,
      code: code.slice(start, end),
      line: message.line,
      column: message.column,
    };
  }
  return {
    ruleId: message.ruleId,
    code: code.slice(start, end),
    line: message.line,
    column: message.column,
  };
}

export function scopeToJSON(scopeManager: ScopeManager): string {
  const scope = normalizeScope(scopeManager.globalScope!);
  return JSON.stringify(scope, nodeReplacer, 2);
}

function normalizeScope(scope: Scope): any {
  let variables = scope.variables;
  if (scope.type === "global") {
    // Exclude well-known variables as they do not need to be tested.
    variables = variables.filter(
      (v) =>
        !TS_GLOBALS.includes(v.name) &&
        !(v.name in globals.builtin) &&
        !(v.name in globals.browser),
    );
  }
  return {
    type: scope.type,
    variables: variables.map(normalizeVar),
    references: scope.references.map(normalizeReference),
    childScopes: scope.childScopes.map(normalizeScope),
    through: scope.through.map(normalizeReference),
  };
}

function normalizeVar(v: Variable) {
  return {
    name: v.name,
    identifiers: v.identifiers,
    defs: v.defs.map(normalizeDef),
    references: v.references.map(normalizeReference),
  };
}

function normalizeReference(reference: Reference) {
  return {
    identifier: reference.identifier,
    from: reference.from.type,
    resolved: reference.resolved?.defs?.[0]?.name ?? null,
    init: reference.init ?? null,
  };
}

function normalizeDef(reference: Definition) {
  return {
    type: reference.type,
    node: reference.node,
    name: reference.name,
  };
}

export function normalizeError(error: any): any {
  return {
    message: error.message,
    index: error.index,
    lineNumber: error.lineNumber,
    column: error.column,
  };
}

/**
 * Remove `parent` properties from the given AST.
 */
// eslint-disable-next-line complexity -- ignore
export function nodeReplacer(key: string, value: any): any {
  if (key === "parent") {
    return undefined;
  }
  if (
    (key === "assertions" || key === "decorators" || key === "extends") &&
    Array.isArray(value) &&
    value.length === 0
  ) {
    // Node types changed in typescript-eslint v6.
    return undefined;
  }
  if ((key === "definite" || key === "declare") && value === false) {
    // Node types changed in typescript-eslint v6.
    return undefined;
  }
  if (value instanceof RegExp) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return null; // Make it null so it can be checked on node8.
    // return `${String(value)}n`
  }
  let obj = value;
  if (obj) {
    if (
      (obj.type === "Identifier" ||
        obj.type === "Property" ||
        obj.type === "ObjectPattern" ||
        obj.type === "AssignmentPattern") &&
      obj.optional === false
    ) {
      // Node types changed in typescript-eslint v6.
      obj = { ...obj };
      delete obj.optional;
    }
    if (
      (obj.type === "TSTypeReference" || obj.type === "CallExpression") &&
      obj.typeParameters
    ) {
      // Node types changed in typescript-eslint v6.
      const copy = { ...obj };
      copy.typeArguments = obj.typeParameters;
      delete copy.typeParameters;
      obj = copy;
    }
    if (obj.type === "TSPropertySignature") {
      // Node types changed in typescript-eslint v6.
      obj = { ...obj };
      for (const k of ["optional", "readonly", "static"]) {
        if (obj[k] === false) {
          delete obj[k];
        }
      }
    }
  }
  return normalizeObject(obj);
}

type TargetNode = AstroNode | TSESTree.JSXNamespacedName;
type AstroKeysType<T extends TargetNode = TargetNode> = {
  [key in TargetNode["type"]]: T extends { type: key }
    ? KeyofObject<T>[]
    : never;
};
type KeyofObject<T> = { [key in keyof T]: key }[keyof T];
const nodeToKeys: AstroKeysType = {
  Program: ["body", "sourceType", "comments", "tokens"],
  AstroFragment: ["children"],
  AstroHTMLComment: ["value"],
  AstroDoctype: [],
  AstroShorthandAttribute: ["name", "value"],
  AstroTemplateLiteralAttribute: ["name", "value"],
  AstroRawText: ["value", "raw"],

  JSXNamespacedName: ["namespace", "name"],
};

function normalizeObject(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const isNode =
    typeof value.type === "string" &&
    (typeof value.start === "number" || typeof value.range?.[0] === "number");

  function firsts(k: string, nodeType: string | null) {
    const o = [
      "type",
      "kind",
      "namespace",
      "name",
      ...((nodeType != null && nodeToKeys[nodeType as keyof AstroKeysType]) ||
        []),
      // scope
      "identifier",
      "from",
      "variables",
      "identifiers",
      "defs",
      "references",
      "childScopes",
    ].indexOf(k);

    return o === -1 ? Infinity : o;
  }

  function lasts(k: string, _nodeType: string | null) {
    return [
      // locs
      "start",
      "end",
      "line",
      "column",
      //
      "range",
      "loc",
    ].indexOf(k);
  }

  let entries = Object.entries(value);
  if (isNode) {
    entries = entries.filter(
      ([k]) => k !== "parent" && k !== "start" && k !== "end",
    );
  }
  const nodeType: string | null = isNode ? value.type : null;

  return Object.fromEntries(
    entries.sort(([a], [b]) => {
      const c =
        firsts(a, nodeType) - firsts(b, nodeType) ||
        lasts(a, nodeType) - lasts(b, nodeType);
      if (c) {
        return c;
      }
      return a < b ? -1 : a > b ? 1 : 0;
    }),
  );
}
