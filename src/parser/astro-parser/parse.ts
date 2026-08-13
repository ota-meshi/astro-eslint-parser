import type { ParseResult } from "../../astro/types";
import type { Context } from "../../context";
import { parse as parseAstro } from "@astrojs/compiler-rs";
import { ParseError } from "../../errors";

/**
 * Parse code by `@astrojs/compiler-rs`.
 *
 * The compiler returns AST locations as JavaScript string indexes, but its
 * diagnostic labels still use byte offsets. Normalize only the diagnostics so
 * every later parser phase can use ESLint-compatible source indexes.
 */
export function parse(code: string, ctx: Context): ParseResult {
  // @astrojs/compiler-rs currently types `ast` as `Record<string, any>`,
  // although the synchronous parser returns an AstroRoot tree. Keep the
  // assertion at this boundary so the rest of the parser can use the detailed
  // compiler node types from `types.ts`.
  const result = parseAstro(code) as ParseResult;
  normalizeDiagnosticLocations(result, code, ctx);

  for (const diagnostic of result.diagnostics || []) {
    if (diagnostic.severity !== "error") {
      continue;
    }
    ctx.originalAST = result.ast;
    const location = diagnostic.labels?.[0]?.start ?? 0;
    throw new ParseError(diagnostic.text, location, ctx);
  }
  return result;
}

/**
 * Normalize compiler diagnostic byte offsets to JavaScript string indices.
 *
 * `@astrojs/compiler-rs` reports AST `start`/`end` as UTF-16 code-unit indexes,
 * but diagnostic labels remain UTF-8 byte offsets. ESLint, `Context`, and
 * JavaScript string slicing all use UTF-16 code-unit indexes. Those values are
 * the same for ASCII, but diverge as soon as a multibyte character appears.
 *
 * Keep the diagnostic conversion in the parse phase so errors use the same
 * coordinate system as the AST and source text.
 */
function normalizeDiagnosticLocations(
  result: ParseResult,
  code: string,
  ctx: Context,
): void {
  const byteOffsetToIndex = buildByteOffsetToIndexMap(code);
  for (const diagnostic of result.diagnostics || []) {
    for (const label of diagnostic.labels || []) {
      label.start = byteOffsetToIndex(label.start);
      label.end = byteOffsetToIndex(label.end);
      // Compiler diagnostics expose line/column too, but the column follows
      // the compiler's character counting. Recompute it from the normalized
      // index so errors and AST ranges use the same coordinate system.
      const loc = ctx.getLocFromIndex(label.start);
      label.line = loc.line;
      label.column = loc.column;
    }
  }
}

/**
 * Build a mapper from compiler byte offsets to JavaScript string indices.
 *
 * The table records both coordinates at each source character boundary. The
 * returned function can then translate any compiler offset with a binary
 * search. If the offset falls between boundaries, it returns the previous
 * JavaScript index; this keeps error locations stable even if the compiler
 * points into a multibyte character boundary.
 */
function buildByteOffsetToIndexMap(source: string): (offset: number) => number {
  const byteOffsets: number[] = [0];
  const codeUnitOffsets: number[] = [0];
  let byteOffset = 0;

  for (let index = 0; index < source.length; ) {
    const codePoint = source.codePointAt(index)!;
    const codeUnitLength = codePoint > 0xffff ? 2 : 1;
    const nextIndex = index + codeUnitLength;
    byteOffset += getUTF8ByteLength(codePoint);
    byteOffsets.push(byteOffset);
    codeUnitOffsets.push(nextIndex);
    index = nextIndex;
  }

  return (offset: number) => {
    let low = 0;
    let high = byteOffsets.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const value = byteOffsets[mid];
      if (value === offset) {
        return codeUnitOffsets[mid];
      }
      if (value < offset) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return codeUnitOffsets[Math.max(high, 0)] ?? 0;
  };
}

/** Get the UTF-8 byte length for a Unicode code point. */
function getUTF8ByteLength(codePoint: number): number {
  if (codePoint <= 0x7f) {
    return 1;
  }
  if (codePoint <= 0x7ff) {
    return 2;
  }
  if (codePoint <= 0xffff) {
    return 3;
  }
  return 4;
}
