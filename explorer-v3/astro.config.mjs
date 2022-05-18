import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import { resolve } from "path";

// https://astro.build/config
export default defineConfig({
  base: "/astro-eslint-parser",
  integrations: [svelte()],
  vite: {
    server: {
      fs: { strict: false },
    },
    resolve: {
      alias: {
        assert: resolve("./build-system/shim/assert.js"),
        path: resolve("./build-system/shim/path.js"),
        fs: resolve("./build-system/shim/fs.js"),
        module: resolve("./build-system/shim/module.js"),
        "eslint/package.json": resolve(
          "./build-system/shim/eslint/package.json"
        ),
        eslint: resolve("./build-system/shim/eslint/index.js"),
        "astro-eslint-parser": resolve(
          "./build-system/shim/astro-eslint-parser/index.js"
        ),
        "@astrojs-compiler-service4b": resolve(
          "./build-system/shim/@astrojs-compiler-service4b/index.js"
        ),
        globby: resolve("./build-system/shim//globby.js"),
        tslib: resolve("../node_modules/tslib/tslib.es6.js"),
      },
    },
    build: {
      rollupOptions: {},
    },
  },
});
