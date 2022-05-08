import fs from "fs"
import Go from "./wasm_exec"
import type { ParseOptions } from "@astrojs/compiler"
const go = new Go()
const wasmBuffer = fs.readFileSync(
    require.resolve("@astrojs/compiler/astro.wasm"),
)
const mod = new WebAssembly.Module(wasmBuffer)
const instance = new WebAssembly.Instance(mod, go.importObject)
void go.run(instance)
const service = (globalThis as any)["@astrojs/compiler"] as {
    parse: (code: string, options: ParseOptions) => { ast: string }
}

/**
 * Parse code by `@astrojs/compiler`
 */
export function parse(
    code: string,
    options: ParseOptions,
): {
    ast: string
} {
    return service.parse(code, options)
}
