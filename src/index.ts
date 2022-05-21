import { parseForESLint } from "./parser"
import { parseTemplate, ParseTemplateResult } from "./astro-tools"
import * as AST from "./ast"
import { traverseNodes } from "./traverse"
import { KEYS } from "./visitor-keys"
import { ParseError } from "./errors"

export { AST, ParseError }

// parser
export { parseForESLint }
// Keys
// eslint-disable-next-line @typescript-eslint/naming-convention -- ignore
export const VisitorKeys = KEYS

// tools
export { traverseNodes, parseTemplate, ParseTemplateResult }
