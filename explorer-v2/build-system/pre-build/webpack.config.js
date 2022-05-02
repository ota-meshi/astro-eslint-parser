import { resolve } from 'path';
import WrapperPlugin from 'wrapper-webpack-plugin';
import webpack from 'webpack';

const output = {
	path: resolve('../shim'),
	filename: '[name]/index.js',
	library: {
		type: 'module'
	}
};
const alias = {
	assert: resolve('./shim-assert.cjs'),
	crypto: resolve('./shim/crypto.js'),
	fs: resolve('../shim/fs.js'),
	path: resolve('../shim/path.js'),
	module: resolve('../shim/module.js'),
	url: resolve('../shim/url.js'),
	util: resolve('../shim/util.js'),
	typescript: resolve('../shim/typescript.js')
};
/** @type {import('webpack').Configuration} */
const base = {
	output,
	resolve: {
		alias,
		fallback: { crypto: false }
	},
	target: ['web'],
	optimization: {
		minimize: false
	},
	mode: 'production',
	experiments: {
		outputModule: true
	},
	externalsType: 'var'
};
/** @type {import('webpack').Configuration[]} */
export default [
	{
		...base,
		entry: {
			eslint: resolve('./eslint.js')
		},
		externals: {
			espree: '$$inject_espree$$',
			esquery: '$$inject_esquery$$'
		},
		plugins: [
			new WrapperPlugin({
				test: /eslint\/index\.js/,
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
				`
			})
		]
	},
	{
		...base,
		entry: {
			'astro-eslint-parser': resolve('./astro-eslint-parser.js')
		},
		module: {
			rules: [
				{
					test: /\.wasm/,
					type: 'asset/inline'
				}
			]
		},
		externals: {
			espree: '$$inject_espree$$'
		},
		plugins: [
			new webpack.NormalModuleReplacementPlugin(
				/astrojs-compiler-service\.js/,
				resolve('./astrojs-compiler-service4b.js')
			),
			new webpack.NormalModuleReplacementPlugin(/wasm_exec\.js/, resolve('./wasm_exec4b.js')),
			new WrapperPlugin({
				test: /astro-eslint-parser\/index\.js/,
				header: `
				import * as $$inject_espree$$ from 'espree';
				if (!globalThis.process) {
					globalThis.process = {
						env:{}
					}
				}
				`
			})
		]
	}
];
