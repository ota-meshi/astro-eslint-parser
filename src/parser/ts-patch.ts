import { createRequire } from "module";
import path from "path";
import fs from "fs";
import type { ParserOptions, TSParserName } from "../context/parser-options";
import { satisfies } from "semver";
import type { EnhancedParserObject } from "../context/resolve-parser/parser-object";
import type { ESLintExtendedProgram, TS } from "../types";
import { parseTsxForTypeScript } from "./ts-for-v5/parse-tsx-for-typescript";

export type PatchTerminate = {
  terminate: () => void;
  parse?: (code: string, parser: EnhancedParserObject) => ESLintExtendedProgram;
};

/**
 * Apply a patch to parse .astro files as TSX.
 */
export function tsPatch(
  scriptParserOptions: ParserOptions,
  tsParserName: TSParserName,
): PatchTerminate | null {
  if (tsParserName === "typescript-eslint-parser-for-extra-files") {
    return {
      terminate() {
        // noop
      },
    };
  }
  let targetExt = ".astro";
  if (scriptParserOptions.filePath) {
    const ext = path.extname(scriptParserOptions.filePath);
    if (ext) {
      targetExt = ext;
    }
  }
  try {
    // Apply a patch to parse .astro files as TSX.
    const cwd = process.cwd();
    const relativeTo = path.join(cwd, "__placeholder__.js");
    const ts: TS = createRequire(relativeTo)("typescript");

    if (satisfies(ts.version, ">=5")) {
      const result = tsPatchForV5(ts, scriptParserOptions);
      if (result) {
        return result;
      }
    } else {
      const result = tsPatchForV4(ts, targetExt);
      if (result) {
        return result;
      }
    }
  } catch {
    // ignore
  }

  // If the patch cannot be applied, create a tsx file and parse it.
  const tsxFilePath = `${scriptParserOptions.filePath}.tsx`;
  scriptParserOptions.filePath = tsxFilePath;
  if (!fs.existsSync(tsxFilePath)) {
    fs.writeFileSync(tsxFilePath, "/* temp for astro-eslint-parser */");

    return {
      terminate() {
        fs.unlinkSync(tsxFilePath);
      },
    };
  }

  return null;
}

/**
 * Apply a patch for typescript v5
 */
function tsPatchForV5(
  ts: TS,
  scriptParserOptions: ParserOptions,
): PatchTerminate | null {
  // Change the parser options passed to the `@typescript-eslint/parser`
  // to allow parsing `*.astro` files as TSX.
  return {
    terminate() {
      // noop
    },
    parse(code, parser) {
      return parseTsxForTypeScript(
        code,
        scriptParserOptions,
        parser as any,
        ts,
      );
    },
  };
}

/**
 * Apply a patch for typescript v4
 */
function tsPatchForV4(ts: TS, targetExt: string): PatchTerminate | null {
  const { ensureScriptKind, getScriptKindFromFileName } = ts;
  if (
    typeof ensureScriptKind !== "function" ||
    typeof getScriptKindFromFileName !== "function"
  ) {
    return null;
  }
  ts.ensureScriptKind = function (fileName: string, ...args: any[]) {
    if (fileName.endsWith(targetExt)) {
      return ts.ScriptKind.TSX;
    }
    return ensureScriptKind.call(this, fileName, ...args);
  };
  ts.getScriptKindFromFileName = function (fileName: string, ...args: any[]) {
    if (fileName.endsWith(targetExt)) {
      return ts.ScriptKind.TSX;
    }
    return getScriptKindFromFileName.call(this, fileName, ...args);
  };
  if (
    ts.ensureScriptKind === ensureScriptKind ||
    ts.getScriptKindFromFileName === getScriptKindFromFileName
  ) {
    // Failed to apply patch.
    return null;
  }
  return {
    terminate() {
      ts.ensureScriptKind = ensureScriptKind;
      ts.getScriptKindFromFileName = getScriptKindFromFileName;
    },
  };
}
