---
"astro-eslint-parser": major
---

Replace `@astrojs/compiler` with `@astrojs/compiler-rs`.

This changes the compiler AST returned by the public `parseTemplate()` API and
can change generated AST node shapes, source ranges, and parser diagnostics.

The following `ParseTemplateResult` helpers have been removed:

- `getEndOffset`
- `calcAttributeValueStartOffset`
- `calcAttributeEndOffset`

Use the new compiler nodes' `start` and `end` offsets where applicable.
`getLocFromIndex` and `getIndexFromLoc` remain available for converting between
offsets and locations.

The `walk` helper now visits the new compiler node types and passes a
`WalkContext` as the third callback argument. The context provides
`skipChildren()` and `break()` controls. Consumers of `parseTemplate()` should
update their visitor types and any AST or parser-error snapshots for the new
compiler output.
