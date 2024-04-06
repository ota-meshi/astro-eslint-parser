/**
 * Code from: https://github.com/typescript-eslint/typescript-eslint/blob/v5.62.0/packages/typescript-estree/src/parseSettings/getProjectConfigFiles.ts
 * Code updated to exclude caching.
 */

import * as fs from "fs";
import * as path from "path";

/** Parse and get project configs */
export function getProjectConfigFiles(
  parseSettings: Readonly<{ filePath: string; tsconfigRootDir: string }>,
  project: string | string[] | true | undefined,
): string[] | undefined {
  if (project !== true) {
    return project === undefined || Array.isArray(project)
      ? project
      : [project];
  }

  let directory = path.dirname(parseSettings.filePath);
  const checkedDirectories = [directory];

  do {
    const tsconfigPath = path.join(directory, "tsconfig.json");
    const cached = fs.existsSync(tsconfigPath) && tsconfigPath;

    if (cached) {
      return [cached];
    }

    directory = path.dirname(directory);
    checkedDirectories.push(directory);
  } while (
    directory.length > 1 &&
    directory.length >= parseSettings.tsconfigRootDir.length
  );

  throw new Error(
    `project was set to \`true\` but couldn't find any tsconfig.json relative to '${parseSettings.filePath}' within '${parseSettings.tsconfigRootDir}'.`,
  );
}
