import type { ParserOptions } from "@typescript-eslint/parser";
import fs from "fs";
import path from "path";

/** Parse and get project configs */
export function getProjectConfigFiles(options: ParserOptions): string[] {
  const tsconfigRootDir =
    typeof options.tsconfigRootDir === "string"
      ? options.tsconfigRootDir
      : process.cwd();
  if (options.project !== true) {
    return Array.isArray(options.project)
      ? options.project
      : [options.project!];
  }

  let directory = path.dirname(options.filePath!);
  const checkedDirectories = [directory];

  do {
    const tsconfigPath = path.join(directory, "tsconfig.json");
    if (fs.existsSync(tsconfigPath)) {
      return [tsconfigPath];
    }

    directory = path.dirname(directory);
    checkedDirectories.push(directory);
  } while (directory.length > 1 && directory.length >= tsconfigRootDir.length);

  throw new Error(
    `project was set to \`true\` but couldn't find any tsconfig.json relative to '${options.filePath}' within '${tsconfigRootDir}'.`
  );
}
