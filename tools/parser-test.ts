import { readFileSync } from "fs"
void main()

/** main */
async function main() {
    // eslint-disable-next-line no-eval -- ignore
    const { parse } = await eval('import("@astrojs/compiler")')

    const contents = readFileSync(
        "./tests/fixtures/parser/ast/escape-bug02-input.astro",
        "utf8",
    )
    const result = await parse(contents)
    // eslint-disable-next-line no-console -- test
    console.log(result)
}
