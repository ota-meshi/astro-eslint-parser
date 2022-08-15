/* global require -- node */
import path from "path"
import fs from "fs"
import semver from "semver"
import type { Linter, Scope as ESLintScope } from "eslint"
import type { TSESTree } from "@typescript-eslint/types"
import { LinesAndColumns } from "../../../src/context"
import type { Reference, Scope, ScopeManager, Variable } from "eslint-scope"
import type { AstroNode } from "../../../src/ast"

const AST_FIXTURE_ROOT = path.resolve(__dirname, "../../fixtures/parser/ast")
export function getBasicParserOptions(
    _filePath = "<input>",
): Linter.BaseConfig["parserOptions"] {
    const parser = "@typescript-eslint/parser"

    // if (filePath.endsWith("03-the-component-template-01-input.astro")) {
    //     // typescript-eslint cannot parse JSXNamespacedName attributes.
    //     parser = "espree"
    // }
    return {
        ecmaVersion: 2020,
        parser,
        project: require.resolve("../../fixtures/tsconfig.test.json"),
        extraFileExtensions: [".astro", ".md"],
        sourceType: "module",
    }
}

export function* listupFixtures(dir?: string): IterableIterator<{
    input: string
    inputFileName: string
    outputFileName: string
    scopeFileName: string
    typeFileName: string | null
    requirements: {
        scope?: Record<string, string>
    }
    getRuleOutputFileName: (ruleName: string) => string
    meetRequirements: (key: "test" | "scope") => boolean
}> {
    yield* listupFixturesImpl(dir || AST_FIXTURE_ROOT)
}

function* listupFixturesImpl(dir: string): IterableIterator<{
    input: string
    inputFileName: string
    outputFileName: string
    scopeFileName: string
    typeFileName: string | null
    requirements: {
        scope?: Record<string, string>
    }
    getRuleOutputFileName: (ruleName: string) => string
    meetRequirements: (key: "test" | "scope") => boolean
}> {
    for (const filename of fs.readdirSync(dir)) {
        const inputFileName = path.join(dir, filename)
        if (filename.endsWith("input.astro") || filename.endsWith("input.md")) {
            const outputFileName = inputFileName.replace(
                /input\.[a-z]+$/u,
                "output.json",
            )
            const scopeFileName = inputFileName.replace(
                /input\.[a-z]+$/u,
                "scope-output.json",
            )
            const typeFileName = inputFileName.replace(
                /input\.([a-z]+)$/u,
                "type-output.$1",
            )
            const requirementsFileName = inputFileName.replace(
                /input\.[a-z]+$/u,
                "requirements.json",
            )

            const input = fs.readFileSync(inputFileName, "utf8")
            const requirements = fs.existsSync(requirementsFileName)
                ? JSON.parse(fs.readFileSync(requirementsFileName, "utf-8"))
                : {}
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
                    )
                },
                meetRequirements(key) {
                    const obj = requirements[key]
                    if (obj) {
                        if (
                            Object.entries(obj).some(
                                ([pkgName, pkgVersion]) => {
                                    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- ignore
                                    const pkg = require(`${pkgName}/package.json`)
                                    return !semver.satisfies(
                                        pkg.version,
                                        pkgVersion as string,
                                    )
                                },
                            )
                        ) {
                            return false
                        }
                    }
                    return true
                },
            }
        }
        if (
            fs.existsSync(inputFileName) &&
            fs.statSync(inputFileName).isDirectory()
        ) {
            yield* listupFixturesImpl(inputFileName)
        }
    }
}

export function getMessageData(
    code: string,
    message: Linter.LintMessage,
): {
    ruleId: string | null
    code: string
    message?: string
    line: number
    column: number
} {
    const linesAndColumns = new LinesAndColumns(code)
    const start = linesAndColumns.getIndexFromLoc({
        line: message.line,
        column: message.column - 1,
    })
    let end: number
    if (message.endLine != null) {
        end = linesAndColumns.getIndexFromLoc({
            line: message.endLine,
            column: message.endColumn! - 1,
        })
    } else {
        end = start + 1
    }
    if (message.ruleId == null) {
        return {
            ruleId: message.ruleId,
            message: message.message,
            code: code.slice(start, end),
            line: message.line,
            column: message.column,
        }
    }
    return {
        ruleId: message.ruleId,
        code: code.slice(start, end),
        line: message.line,
        column: message.column,
    }
}

export function scopeToJSON(scopeManager: ScopeManager): string {
    const scope = normalizeScope(scopeManager.globalScope)
    return JSON.stringify(scope, nodeReplacer, 2)
}

function normalizeScope(scope: Scope): any {
    return {
        type: scope.type,
        variables: scope.variables.map(normalizeVar),
        references: scope.references.map(normalizeReference),
        childScopes: scope.childScopes.map(normalizeScope),
        through: scope.through.map(normalizeReference),
    }
}

function normalizeVar(v: Variable) {
    return {
        name: v.name,
        identifiers: v.identifiers,
        defs: v.defs.map(normalizeDef),
        references: v.references.map(normalizeReference),
    }
}

function normalizeReference(reference: Reference) {
    return {
        identifier: reference.identifier,
        from: reference.from.type,
        resolved: reference.resolved?.defs?.[0]?.name ?? null,
        init: reference.init ?? null,
    }
}

function normalizeDef(reference: ESLintScope.Definition) {
    return {
        type: reference.type,
        node: reference.node,
        name: reference.name,
    }
}

export function normalizeError(error: any): any {
    return {
        message: error.message,
        index: error.index,
        lineNumber: error.lineNumber,
        column: error.column,
    }
}

/**
 * Remove `parent` properties from the given AST.
 */
export function nodeReplacer(key: string, value: any): any {
    if (key === "parent") {
        return undefined
    }
    if (key === "assertions" && Array.isArray(value) && value.length === 0) {
        return undefined
    }
    if (value instanceof RegExp) {
        return String(value)
    }
    if (typeof value === "bigint") {
        return null // Make it null so it can be checked on node8.
        // return `${String(value)}n`
    }
    return normalizeObject(value)
}

type TargetNode = AstroNode | TSESTree.JSXNamespacedName
type AstroKeysType<T extends TargetNode = TargetNode> = {
    [key in TargetNode["type"]]: T extends { type: key }
        ? KeyofObject<T>[]
        : never
}
type KeyofObject<T> = { [key in keyof T]: key }[keyof T]
const nodeToKeys: AstroKeysType = {
    Program: ["body", "sourceType", "comments", "tokens"],
    AstroFragment: ["children"],
    AstroHTMLComment: ["value"],
    AstroDoctype: [],
    AstroShorthandAttribute: ["name", "value"],
    AstroTemplateLiteralAttribute: ["name", "value"],
    AstroRawText: ["value", "raw"],

    JSXNamespacedName: ["namespace", "name"],
}

function normalizeObject(value: any) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return value
    }
    const isNode =
        typeof value.type === "string" &&
        (typeof value.start === "number" ||
            typeof value.range?.[0] === "number")

    function firsts(k: string, nodeType: string | null) {
        const o = [
            "type",
            "kind",
            "namespace",
            "name",
            ...((nodeType != null &&
                nodeToKeys[nodeType as keyof AstroKeysType]) ||
                []),
            // scope
            "identifier",
            "from",
            "variables",
            "identifiers",
            "defs",
            "references",
            "childScopes",
        ].indexOf(k)

        return o === -1 ? Infinity : o
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
        ].indexOf(k)
    }

    let entries = Object.entries(value)
    if (isNode) {
        entries = entries.filter(
            ([k]) => k !== "parent" && k !== "start" && k !== "end",
        )
    }
    const nodeType: string | null = isNode ? value.type : null

    return Object.fromEntries(
        entries.sort(([a], [b]) => {
            const c =
                firsts(a, nodeType) - firsts(b, nodeType) ||
                lasts(a, nodeType) - lasts(b, nodeType)
            if (c) {
                return c
            }
            return a < b ? -1 : a > b ? 1 : 0
        }),
    )
}
