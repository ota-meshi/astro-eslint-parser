import { defineConfig } from "tsdown";

// Match package imports like "eslint" or "@scope/pkg". Relative imports are
// still bundled into the library output.
const bareModuleRE = /^(?![./]|[a-z]:)/i;

export default defineConfig({
  clean: true,
  deps: {
    // Keep dependency types referenced from node_modules instead of inlining
    // large third-party declaration files into lib/index.d.mts.
    dts: {
      neverBundle: [bareModuleRE],
    },
    // Keep runtime dependencies external so consumers resolve the same package
    // dependency graph declared in package.json.
    neverBundle: [bareModuleRE],
    // We intentionally externalize all package imports above, so disable the
    // advisory warning about dependencies detected in the bundle.
    onlyBundle: false,
  },
  dts: true,
  entry: ["src/index.ts"],
  format: "esm",
  outDir: "lib",
});
