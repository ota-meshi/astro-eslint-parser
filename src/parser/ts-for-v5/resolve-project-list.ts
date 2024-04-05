/**
 * Code from: https://github.com/typescript-eslint/typescript-eslint/blob/v5.62.0/packages/typescript-estree/src/parseSettings/resolveProjectList.ts
 * Code updated to exclude caching.
 */

import { sync as globSync } from "globby";
import isGlob from "is-glob";
import * as path from "path";
import * as ts from "typescript";

import type { ParserOptions } from "@typescript-eslint/types";
import type { TSESTreeOptions } from "@typescript-eslint/typescript-estree";

/**
 * Normalizes, sanitizes, resolves and filters the provided project paths
 */
export function resolveProjectList(
  options: Readonly<{
    project: TSESTreeOptions["project"];
    projectFolderIgnoreList: ParserOptions["projectFolderIgnoreList"];
    tsconfigRootDir: string;
  }>,
): readonly string[] {
  const sanitizedProjects: string[] = [];

  // Normalize and sanitize the project paths
  if (typeof options.project === "string") {
    sanitizedProjects.push(options.project);
  } else if (Array.isArray(options.project)) {
    for (const project of options.project) {
      if (typeof project === "string") {
        sanitizedProjects.push(project);
      }
    }
  }

  if (sanitizedProjects.length === 0) {
    return [];
  }

  const projectFolderIgnoreList = (
    options.projectFolderIgnoreList ?? ["**/node_modules/**"]
  )
    .reduce<string[]>((acc, folder) => {
      if (typeof folder === "string") {
        acc.push(folder);
      }
      return acc;
    }, [])
    // prefix with a ! for not match glob
    .map((folder) => (folder.startsWith("!") ? folder : `!${folder}`));

  // Transform glob patterns into paths
  const nonGlobProjects = sanitizedProjects.filter(
    (project) => !isGlob(project),
  );
  const globProjects = sanitizedProjects.filter((project) => isGlob(project));

  const uniqueCanonicalProjectPaths = new Set(
    nonGlobProjects
      .concat(
        globProjects.length === 0
          ? []
          : globSync([...globProjects, ...projectFolderIgnoreList], {
              cwd: options.tsconfigRootDir,
            }),
      )
      .map((project) =>
        getCanonicalFileName(
          ensureAbsolutePath(project, options.tsconfigRootDir),
        ),
      ),
  );

  const returnValue = Array.from(uniqueCanonicalProjectPaths);
  return returnValue;
}

/**
 * Below code from: https://github.com/typescript-eslint/typescript-eslint/blob/v5.62.0/packages/typescript-estree/src/create-program/shared.ts#L53-L71
 */

// typescript doesn't provide a ts.sys implementation for browser environments
const useCaseSensitiveFileNames =
  ts.sys !== undefined ? ts.sys.useCaseSensitiveFileNames : true;
const correctPathCasing = useCaseSensitiveFileNames
  ? (filePath: string): string => filePath
  : (filePath: string): string => filePath.toLowerCase();

/** */
function getCanonicalFileName(filePath: string): string {
  let normalized = path.normalize(filePath);
  if (normalized.endsWith(path.sep)) {
    normalized = normalized.slice(0, -1);
  }
  return correctPathCasing(normalized);
}

/** */
function ensureAbsolutePath(p: string, tsconfigRootDir: string): string {
  return path.isAbsolute(p)
    ? p
    : path.join(tsconfigRootDir || process.cwd(), p);
}
