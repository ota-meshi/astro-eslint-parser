import type { SourceCode } from "eslint"
import { unionWith } from "eslint-visitor-keys"
import type { AstroNode } from "./ast"

type AstroKeysType<T extends AstroNode = AstroNode> = {
    [key in AstroNode["type"]]: T extends { type: key }
        ? KeyofObject<T>[]
        : never
}
type KeyofObject<T> = { [key in keyof T]-?: key }[keyof T]

const astroKeys: AstroKeysType = {
    Program: ["body"],
    AstroFragment: ["children"],
    AstroHTMLComment: [],
    AstroDoctype: [],
    AstroShorthandAttribute: ["name", "value"],
    AstroTemplateLiteralAttribute: ["name", "value"],
    AstroRawText: [],
}

export const KEYS: SourceCode.VisitorKeys = unionWith(
    astroKeys,
) as SourceCode.VisitorKeys
