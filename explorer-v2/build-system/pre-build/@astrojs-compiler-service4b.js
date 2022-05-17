let service;

if (typeof atob !== 'undefined' && typeof window !== 'undefined') {
	window.waitSetupForAstroCompilerWasm = setup();
}

/**
 * Parse code by `@astrojs/compiler`
 */
export function parse(code, options) {
	if (!service) {
		// eslint-disable-next-line node/no-unsupported-features/es-builtins -- ignore
		service = globalThis['@astrojs/compiler'];
	}
	const { ast } = service.parse(code, options);
	return { ast };
}

/** setup */
async function setup() {
	let bkProcess;
	if (typeof globalThis.process !== 'undefined') {
		bkProcess = globalThis.process;
	}

	const [{ default: Go }, { default: wasmBuffer }] = await Promise.all([
		import('../../../node_modules/@astrojs/compiler/browser/wasm_exec.js'),
		// eslint-disable-next-line node/no-extraneous-import -- ignore
		import('@astrojs/compiler/astro.wasm')
	]);

	// Adjust process object
	if (bkProcess) {
		// eslint-disable-next-line require-atomic-updates -- ignore
		globalThis.process = bkProcess;
	} else {
		// eslint-disable-next-line no-process-env -- ignore
		process.env = {};
		process.cwd = () => '';
		process.hrtime = () => Date.now();
	}
	const go = new Go();
	try {
		const mod = await WebAssembly.compile(wasmBuffer);
		const instance = await WebAssembly.instantiate(mod, go.importObject);
		go.run(instance);

		return watch();
	} catch (e) {
		// eslint-disable-next-line no-console -- log
		console.log(e);
		throw e;
	}

	function watch() {
		return new Promise((resolve) => {
			// eslint-disable-next-line node/no-unsupported-features/es-builtins -- ignore
			if (globalThis['@astrojs/compiler']) {
				resolve();
			} else {
				setTimeout(() => {
					resolve(watch());
				}, 100);
			}
		});
	}
}
