import { resolve } from "path";
import WrapperPlugin from "wrapper-webpack-plugin";
import webpack from "webpack";

const output = {
  path: resolve("../shim"),
  filename: "index.js",
  library: {
    type: "module",
  },
};
const alias = {
  assert: resolve("./shim-assert.cjs"),
  crypto: resolve("./shim/crypto.js"),
  fs: resolve("../shim/fs.js"),
  path: resolve("../shim/path.js"),
  module: resolve("../shim/module.js"),
  url: resolve("../shim/url.js"),
  util: resolve("../shim/util.js"),
  typescript: resolve("../shim/typescript.js"),
  [resolve("../../../lib/parser/astro-parser/astrojs-compiler-service.js")]:
    resolve("./astrojs-compiler-service4b-inject.js"),
  [resolve("../../../lib/markdown/mdast-util-from-markdown-service.js")]:
    resolve("./mdast-util-from-markdown-service4b-inject.js"),
};

function getBase(name) {
  /** @type {import('webpack').Configuration} */
  const base = {
    output: { ...output, path: resolve(`../shim/${name}`) },
    resolve: {
      alias,
      fallback: { crypto: false },
      modules: [
        resolve("../../node_modules"),
        resolve("../../../node_modules"),
      ],
    },
    target: ["web"],
    optimization: {
      minimize: false,
    },
    mode: "production",
    experiments: {
      outputModule: true,
    },
    externalsType: "var",
  };
  return base;
}

/** @type {import('webpack').Configuration[]} */
export default [
  {
    ...getBase("eslint"),
    entry: {
      eslint: resolve("./eslint.js"),
    },
    externals: {
      espree: "$$inject_espree$$",
      esquery: "$$inject_esquery$$",
      "escape-string-regexp": "$$inject_escape_string_regexp$$",
    },
    plugins: [
      new WrapperPlugin({
        test: /^index\.js/,
        header: `
				if (typeof window !== "undefined") {
					if (typeof window.global === "undefined") {
						window.global = {}
					}
					if (typeof window.process === "undefined") {
						window.process = {
							env: {},
							cwd: () => undefined,
						}
					}
				}
				import * as $$inject_espree$$ from 'espree';
				import $$inject_esquery$$ from 'esquery';
				import * as $$inject_escape_string_regexp$$_all from 'escape-string-regexp';
        const $$inject_escape_string_regexp$$ = $$inject_escape_string_regexp$$_all.default;
				`,
      }),
    ],
  },
  {
    ...getBase("escape-string-regexp"),
    entry: {
      "escape-string-regexp": resolve("./escape-string-regexp.js"),
    },
  },
  {
    ...getBase("astro-eslint-parser"),
    entry: {
      "astro-eslint-parser": resolve("./astro-eslint-parser.js"),
    },
    module: {
      rules: [
        {
          test: /context\/resolve-parser\/index\.js$/u,
          loader: "string-replace-loader",
          options: {
            search: /require\(name\)/gu.source,
            replace: () => "__non_webpack_require__(name)",
            flags: "g",
          },
        },
      ],
    },
    externals: {
      espree: "$$inject_espree$$",
      pako: "$$inject_pako$$",
      "@astrojs-compiler-service4b": "$$inject_astrojs_compiler_service4b$$",
      "@mdast-util-from-markdown-service4b":
        "$$inject_mdast_util_from_markdown_service4b$$",
    },
    plugins: [
      new WrapperPlugin({
        test: /^index\.js/,
        header: `
				import * as $$inject_espree$$ from 'espree';
				import * as $$inject_astrojs_compiler_service4b$$ from '@astrojs-compiler-service4b';
				import * as $$inject_mdast_util_from_markdown_service4b$$ from '@mdast-util-from-markdown-service4b';
				const self = globalThis;
				`,
      }),
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
    ],
  },
  {
    ...getBase("@astrojs-compiler-service4b"),
    entry: {
      "@astrojs-compiler-service4b": resolve(
        "./@astrojs-compiler-service4b.js"
      ),
    },
    module: {
      rules: [
        {
          test: /\.wasm/,
          // type: 'asset/inline'
          loader: resolve("./binary-loader.cjs"),
        },
      ],
    },
    externals: {
      pako: "$$inject_pako$$",
    },
    plugins: [
      new WrapperPlugin({
        test: /^index\.js/,
        header: `
				import $$inject_pako$$ from 'pako';
				const self = globalThis;
				`,
      }),
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
    ],
  },
];
