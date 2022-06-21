import { createSyncFn } from "synckit"
import type * as mdast from "mdast"
import type { ParseSyncFunction } from "./mdast-util-from-markdown-worker"

const parseSync: ParseSyncFunction = createSyncFn(
    require.resolve("./mdast-util-from-markdown-worker"),
)

/**
 * Parse code by `mdast-util-from-markdown`
 */
export function parseMarkdown(code: string): mdast.Root {
    return parseSync(code)
}
