import path from "path"
import fs from "fs"
import { getParser, getParserName } from "./resolve-parser"
import type { ESLintCustomParser } from "../types"

export class ParserOptionsContext {
    public readonly parserOptions: any

    private readonly state: { isTypeScript?: boolean; originalAST?: any } = {}

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
        }
        parserOptions.ecmaFeatures = {
            ...(parserOptions.ecmaFeatures || {}),
            jsx: true,
        }
        parserOptions.sourceType = "module"
        if (
            parserOptions.ecmaVersion <= 5 ||
            parserOptions.ecmaVersion == null
        ) {
            parserOptions.ecmaVersion = 2015
        }
        this.parserOptions = parserOptions
    }

    public getParser(): ESLintCustomParser {
        return getParser({}, this.parserOptions.parser)
    }

    public isTypeScript(): boolean {
        if (this.state.isTypeScript != null) {
            return this.state.isTypeScript
        }
        const parserName = getParserName({}, this.parserOptions?.parser)
        if (parserName === "@typescript-eslint/parser") {
            return (this.state.isTypeScript = true)
        }
        if (parserName.includes("@typescript-eslint/parser")) {
            let targetPath = parserName
            while (targetPath) {
                const pkgPath = path.join(targetPath, "package.json")
                if (fs.existsSync(pkgPath)) {
                    try {
                        return (this.state.isTypeScript =
                            JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
                                ?.name === "@typescript-eslint/parser")
                    } catch {
                        return (this.state.isTypeScript = false)
                    }
                }
                const parent = path.dirname(targetPath)
                if (targetPath === parent) {
                    break
                }
                targetPath = parent
            }
        }

        return (this.state.isTypeScript = false)
    }
}
