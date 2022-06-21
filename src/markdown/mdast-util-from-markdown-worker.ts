import { runAsWorker } from "synckit"
import type * as mdast from "mdast"
import type * as mdastUtilFromMarkdown from "mdast-util-from-markdown"

type MdastUtilFromMarkdown = typeof mdastUtilFromMarkdown

export type ParseSyncFunction = (source: string) => mdast.Root
const dynamicImport = new Function("m", "return import(m)")
runAsWorker(async (source: string): Promise<mdast.Root> => {
    const { fromMarkdown }: MdastUtilFromMarkdown = await dynamicImport(
        "mdast-util-from-markdown",
    )
    return fromMarkdown(source)
})
