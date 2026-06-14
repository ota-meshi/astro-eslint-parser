import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import { resolve } from "path";
import { version as monacoVersion } from "monaco-editor/package.json";

// https://astro.build/config
export default defineConfig({
  base: "/astro-eslint-parser",
  integrations: [svelte()],
  outDir: resolve("./dist/astro-eslint-parser"),
  vite: {
    server: {
      fs: { strict: false },
    },
    define: {
      MONACO_EDITOR_VERSION: JSON.stringify(monacoVersion),
    },
    optimizeDeps: {
      // Do not prebundle compiler-rs: its WASI browser entry resolves a sibling
      // .wasm file, and prebundling rewrites that URL to node_modules/.vite/deps.
      exclude: [
        "@astrojs/compiler-binding",
        "@astrojs/compiler-binding-wasm32-wasi",
        "@astrojs/compiler-rs",
      ],
    },
    resolve: {
      alias: [
        // Browser-safe shims for Node built-ins that parser dependencies touch.
        {
          find: "assert",
          replacement: resolve("./build-system/shim/assert.js"),
        },
        {
          find: "crypto",
          replacement: resolve("./build-system/shim/crypto.js"),
        },
        { find: "fs", replacement: resolve("./build-system/shim/fs.js") },
        {
          find: "module",
          replacement: resolve("./build-system/shim/module.js"),
        },
        { find: "path", replacement: resolve("./build-system/shim/path.js") },
        {
          find: "node:path",
          replacement: resolve("./build-system/shim/path.js"),
        },
        { find: "url", replacement: resolve("./build-system/shim/url.js") },
        { find: "util", replacement: resolve("./build-system/shim/util.js") },
        // Use the already-built ESM parser instead of maintaining a second
        // browser bundle of astro-eslint-parser for the explorer.
        {
          find: "astro-eslint-parser",
          replacement: resolve("../lib/index.mjs"),
        },
        // Force compiler-rs onto its browser binding; the default binding
        // imports node:module and native .node packages.
        {
          find: "@astrojs/compiler-binding",
          replacement: resolve(
            "../node_modules/@astrojs/compiler-binding/browser.js",
          ),
        },
        // The wasm32-wasi binding is optional for Node installs, so the explorer
        // carries it directly and aliases exact imports to its browser files.
        {
          find: /^@astrojs\/compiler-binding-wasm32-wasi$/,
          replacement: resolve(
            "./node_modules/@astrojs/compiler-binding-wasm32-wasi/astro.wasi-browser.js",
          ),
        },
        {
          find: /^@astrojs\/compiler-binding-wasm32-wasi\/wasi-worker-browser\.mjs$/,
          replacement: resolve(
            "./node_modules/@astrojs/compiler-binding-wasm32-wasi/wasi-worker-browser.mjs",
          ),
        },
        // Parser internals may resolve these packages when TypeScript/project
        // options are present; the explorer does not use filesystem access.
        {
          find: "fast-glob",
          replacement: resolve("./build-system/shim/fast-glob.js"),
        },
        // Resolve tslib from the root install because explorer dependencies are
        // intentionally hoisted for Astro-related packages.
        {
          find: "tslib",
          replacement: resolve("../node_modules/tslib/tslib.es6.js"),
        },
        // Avoid bundling Node's resolve package into the browser build.
        {
          find: "resolve",
          replacement: resolve("./build-system/shim/resolve.js"),
        },
      ],
    },
  },
});
