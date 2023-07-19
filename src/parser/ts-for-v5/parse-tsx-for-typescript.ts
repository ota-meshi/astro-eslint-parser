import type { ParserOptions } from "@typescript-eslint/types";
import type * as tsParserAll from "@typescript-eslint/parser";
import type { ESLintExtendedProgram, TS } from "../../types";
import { getProjectConfigFiles } from "./get-project-config-files";
import { getTSProgram } from "./programs";

const DEFAULT_EXTRA_FILE_EXTENSIONS = [".vue", ".svelte", ".astro"];
/**
 * Parse for TSX by typescript v5
 */
export function parseTsxForTypeScript(
  code: string,
  options: ParserOptions,
  tsEslintParser: typeof tsParserAll,
  ts: TS,
): ESLintExtendedProgram {
  const programs = [];
  for (const option of iterateOptions(options)) {
    programs.push(getTSProgram(code, option, ts));
  }
  const parserOptions: ParserOptions = {
    ...options,
    programs,
  };
  return tsEslintParser.parseForESLint(code, parserOptions) as any;
}

export type ProgramOptions = {
  project: string;
  filePath: string;
  extraFileExtensions: string[];
};

/** Iterate ProgramOptions */
function* iterateOptions(options: ParserOptions): Iterable<ProgramOptions> {
  if (!options) {
    throw new Error("`parserOptions` is required.");
  }
  if (!options.filePath) {
    throw new Error("`filePath` is required.");
  }
  if (!options.project) {
    throw new Error(
      "Specify `parserOptions.project`. Otherwise there is no point in using this parser.",
    );
  }
  for (const project of getProjectConfigFiles(options)) {
    yield {
      project,
      filePath: options.filePath,
      extraFileExtensions:
        options.extraFileExtensions || DEFAULT_EXTRA_FILE_EXTENSIONS,
    };
  }
}
