import { createRequire } from "module"
import type { ParserOptions } from "@typescript-eslint/types"
import path from "path"
import fs from "fs"
import type { ScriptKind } from "typescript"
type TS = {
    ScriptKind: typeof ScriptKind
    ensureScriptKind?: (fileName: string, ...args: any[]) => ScriptKind
    getScriptKindFromFileName?: (fileName: string, ...args: any[]) => ScriptKind
}

export type PatchTerminate = { terminate: () => void }

/**
 * Apply a patch to parse .astro files as TSX.
 */
export function patch(
    scriptParserOptions: ParserOptions,
): PatchTerminate | null {
    try {
        // Apply a patch to parse .astro files as TSX.
        const cwd = process.cwd()
        const relativeTo = path.join(cwd, "__placeholder__.js")
        const ts: TS = createRequire(relativeTo)("typescript")

        const { ensureScriptKind, getScriptKindFromFileName } = ts
        if (
            typeof ensureScriptKind === "function" &&
            typeof getScriptKindFromFileName === "function"
        ) {
            ts.ensureScriptKind = function (fileName: string, ...args: any[]) {
                if (fileName.endsWith(".astro")) {
                    return ts.ScriptKind.TSX
                }
                return ensureScriptKind.call(this, fileName, ...args)
            }
            ts.getScriptKindFromFileName = function (
                fileName: string,
                ...args: any[]
            ) {
                if (fileName.endsWith(".astro")) {
                    return ts.ScriptKind.TSX
                }
                return getScriptKindFromFileName.call(this, fileName, ...args)
            }
            return {
                terminate() {
                    ts.ensureScriptKind = ensureScriptKind
                    ts.getScriptKindFromFileName = getScriptKindFromFileName
                },
            }
        }
    } catch {
        // ignore
    }

    // If the patch cannot be applied, create a tsx file and parse it.
    const tsxFilePath = `${scriptParserOptions.filePath}.tsx`
    scriptParserOptions.filePath = tsxFilePath
    if (!fs.existsSync(tsxFilePath)) {
        fs.writeFileSync(tsxFilePath, "/* temp for astro-eslint-parser */")

        return {
            terminate() {
                fs.unlinkSync(tsxFilePath)
            },
        }
    }

    return null
}
