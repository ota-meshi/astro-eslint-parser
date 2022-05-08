import Go from './wasm_exec';
// eslint-disable-next-line node/no-extraneous-import -- ignore
import wasmBuffer from '@astrojs/compiler/astro.wasm';

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
	return service.parse(code, options);
}

/** setup */
async function setup() {
	const go = new Go();
	const mod = await WebAssembly.compile(dataURItoUint8Array(wasmBuffer));
	const instance = await WebAssembly.instantiate(mod, go.importObject);
	go.run(instance);

	return watch();

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

function dataURItoUint8Array(dataURI) {
	// convert base64 to raw binary data held in a string
	// doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
	const byteString = atob(dataURI.split(',')[1]);

	// write the bytes of the string to an ArrayBuffer
	const ab = new ArrayBuffer(byteString.length);

	// create a view into the buffer
	const ia = new Uint8Array(ab);

	// set the bytes of the buffer to the correct values
	for (let i = 0; i < byteString.length; i++) {
		ia[i] = byteString.charCodeAt(i);
	}

	return ia;
}
