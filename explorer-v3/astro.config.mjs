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
    resolve: {
      alias: {
        assert: resolve("./build-system/shim/assert.js"),
        path: resolve("./build-system/shim/path.js"),
        "node:path": resolve("./build-system/shim/path.js"),
        fs: resolve("./build-system/shim/fs.js"),
        module: resolve("./build-system/shim/module.js"),
        "astro-eslint-parser": resolve(
          "./build-system/shim/astro-eslint-parser/index.js",
        ),
        globby: resolve("./build-system/shim/globby.js"),
        "fast-glob": resolve("./build-system/shim/fast-glob.js"),
        tslib: resolve("../node_modules/tslib/tslib.es6.js"),
        "escape-string-regexp": resolve(
          "./build-system/shim/escape-string-regexp/index.js",
        ),
        resolve: resolve("./build-system/shim/resolve.js"),
      },
    },
    build: {
      rollupOptions: {},
    },
  },
});
