import * as eslintScope from "eslint-scope";
import semver from "semver";
import path from "path";
import { createRequire } from "module";

type ESLintScope = typeof eslintScope;
let eslintScopeCache: ESLintScope | null = null;

/**
 * Load the newest `eslint-scope` from the loaded ESLint or dependency.
 */
export function getEslintScope(): ESLintScope {
  return eslintScopeCache ?? (eslintScopeCache = getNewest());
}

/**
 * Load the newest `eslint-scope` from the dependency.
 */
function getNewest(): ESLintScope {
  let newest = eslintScope;
  const userEslintScope = getEslintScopeFromUser();
  if (
    userEslintScope &&
    userEslintScope.version != null &&
    semver.lte(newest.version, userEslintScope.version)
  ) {
    newest = userEslintScope;
  }
  const eslintEslintScope = getEslintScopeFromEslint();
  if (
    eslintEslintScope &&
    eslintEslintScope.version != null &&
    semver.lte(newest.version, eslintEslintScope.version)
  ) {
    newest = eslintEslintScope;
  }

  return newest;
}

/**
 * Load `eslint-scope` from the user dir.
 */
function getEslintScopeFromUser(): ESLintScope | null {
  try {
    const cwd = process.cwd();
    const relativeTo = path.join(cwd, "__placeholder__.js");
    return createRequire(relativeTo)("eslint-scope");
  } catch {
    return null;
  }
}

/**
 * Load `eslint-scope` from the eslint dir.
 */
function getEslintScopeFromEslint(): ESLintScope | null {
  try {
    const cwd = process.cwd();
    const requireFromUser = createRequire(path.join(cwd, "__placeholder__.js"));
    const eslintPackagePath = requireFromUser.resolve("eslint/package.json");
    const requireFromEslint = createRequire(
      eslintPackagePath.replace(/package\.json$/, "__placeholder__.js"),
    );
    return requireFromEslint("eslint-scope");
  } catch {
    return null;
  }
}
