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
  "fast-glob": resolve("../shim/fast-glob.js"),
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
    externals: {
      espree: "$$inject_espree$$",
      pako: "$$inject_pako$$",
    },
    module: {
      rules: [
        {
          test: /\.wasm/,
          loader: resolve("./binary-loader.cjs"),
        },
      ],
    },
    plugins: [
      new WrapperPlugin({
        test: /^index\.js/,
        header: `
				import * as $$inject_espree$$ from 'espree';
				const self = globalThis;
				`,
      }),
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
    ],
  },
];
