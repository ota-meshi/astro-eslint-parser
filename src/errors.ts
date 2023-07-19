import type { Context } from "./context";

/**
 * Astro parse errors.
 */
export class ParseError extends SyntaxError {
  public index: number;

  public lineNumber: number;

  public column: number;

  public originalAST: any;

  /**
   * Initialize this ParseError instance.
   */
  public constructor(
    message: string,
    offset: number | { line: number; column: number },
    ctx: Context,
  ) {
    super(message);
    if (typeof offset === "number") {
      this.index = offset;
      const loc = ctx.getLocFromIndex(offset);
      this.lineNumber = loc.line;
      this.column = loc.column;
    } else {
      this.index = ctx.getIndexFromLoc(offset);
      this.lineNumber = offset.line;
      this.column = offset.column;
    }
    this.originalAST = ctx.originalAST;
  }
}
