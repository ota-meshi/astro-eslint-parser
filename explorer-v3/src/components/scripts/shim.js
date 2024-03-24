if (typeof globalThis.process === "undefined") {
  globalThis.process = {};
}

const d = globalThis; // Avoid minify

if (!d.process.env) {
  d.process.env = {};
}
if (!d.process.cwd) {
  d.process.cwd = () => "/";
}
