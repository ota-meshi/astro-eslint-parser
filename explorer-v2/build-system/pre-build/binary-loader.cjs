const pako = require('pako');
module.exports = function (source) {
	let content = source;
	if (typeof source === 'string') {
		// eslint-disable-next-line no-param-reassign -- ignore
		content = Buffer.from(source);
	}

	const buffer = /** @type {Uint8Array} */ (content);
	const compressed = pako.deflate(buffer);
	const base64 = Buffer.from(compressed).toString('base64');
	return `import pako from 'pako';
const base64 = ${JSON.stringify(base64)};
const compressedString = window.atob(base64);
const uint8Arr = pako.inflate(Uint8Array.from(compressedString, (c) => c.charCodeAt(0)));
export default uint8Arr;
`;
};
module.exports.raw = true;
