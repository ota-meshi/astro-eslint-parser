// eslint-disable-next-line node/no-extraneous-import -- ignore
import { fromMarkdown } from "mdast-util-from-markdown";

/**
 * Parse code by `mdast-util-from-markdown`
 */
export function parseMarkdown(code) {
  return fromMarkdown(code);
}
