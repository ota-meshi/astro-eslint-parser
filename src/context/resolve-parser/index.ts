import type { ESLintCustomParser } from "../../types"
import { getEspree } from "./espree"

/** Get parser name */
export function getParserName(
    attrs: Record<string, string | undefined>,
    parser: any,
): string {
    if (parser) {
        if (typeof parser === "string" && parser !== "espree") {
            return parser
        } else if (typeof parser === "object") {
            const name = parser[attrs.lang || "js"]
            if (typeof name === "string") {
                return getParserName(attrs, name)
            }
        }
    }
    return "espree"
}

/** Get parser */
export function getParser(
    attrs: Record<string, string | undefined>,
    parser: any,
): ESLintCustomParser {
    const name = getParserName(attrs, parser)
    if (name !== "espree") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- ignore
        return require(name)
    }
    return getEspree()
}
