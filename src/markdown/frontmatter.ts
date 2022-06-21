export type MarkdownContent = {
    range: [number, number]
    value: string
}

/** Parse frontmatter */
export function parseFrontmatter(code: string): {
    frontmatter: MarkdownContent | null
    content: MarkdownContent
} {
    if (!code.startsWith("---") || code[3] === "-") {
        return {
            frontmatter: null,
            content: {
                range: [0, code.length],
                value: code,
            },
        }
    }
    let closeIndex = code.indexOf("\n---", 3)
    let contentOpenIndex = closeIndex + 4
    if (closeIndex === -1) {
        closeIndex = code.length
        contentOpenIndex = code.length
    }
    let openIndex = 3
    if (code[openIndex] === "\r") {
        openIndex++
    }
    if (code[openIndex] === "\n") {
        openIndex++
    }
    if (openIndex < closeIndex && code[closeIndex] === "\n") {
        closeIndex--
    }
    if (openIndex < closeIndex && code[closeIndex] === "\r") {
        closeIndex++
    }
    if (code[contentOpenIndex] === "\r") {
        contentOpenIndex++
    }
    if (code[contentOpenIndex] === "\n") {
        contentOpenIndex++
    }
    const frontmatter = code.slice(openIndex, closeIndex + 1)
    const content = code.slice(contentOpenIndex)
    return {
        frontmatter: {
            range: [openIndex, closeIndex + 1],
            value: frontmatter,
        },
        content: {
            range: [contentOpenIndex, code.length],
            value: content,
        },
    }
}
