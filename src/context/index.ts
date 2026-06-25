import type { TSESTree } from "@typescript-eslint/types";
import { sortedLastIndex } from "../util";

type RangeAndLoc = {
  range: TSESTree.Range;
  loc: TSESTree.SourceLocation;
};
export class Context {
  public readonly code: string;

  public readonly filePath?: string;

  public readonly locs: LinesAndColumns;

  private readonly locsMap = new Map<number, TSESTree.Position>();

  private readonly state: { isTypeScript?: boolean; originalAST?: any } = {};

  public constructor(code: string, filePath?: string) {
    this.locs = new LinesAndColumns(code);
    this.code = code;
    this.filePath = filePath;
  }

  public getLocFromIndex(index: number): { line: number; column: number } {
    let loc = this.locsMap.get(index);
    if (!loc) {
      loc = this.locs.getLocFromIndex(index);
      this.locsMap.set(index, loc);
    }
    return {
      line: loc.line,
      column: loc.column,
    };
  }

  public getIndexFromLoc(loc: { line: number; column: number }): number {
    return this.locs.getIndexFromLoc(loc);
  }

  /**
   * Get the location information of the given indexes.
   */
  public getLocations(start: number, end: number): RangeAndLoc {
    return {
      range: [start, end],
      loc: {
        start: this.getLocFromIndex(start),
        end: this.getLocFromIndex(end),
      },
    };
  }

  /**
   * Build token
   */
  public buildToken(
    type: TSESTree.Token["type"],
    range: TSESTree.Range,
  ): TSESTree.Token {
    return {
      type,
      value: this.getText(range),
      ...this.getLocations(...range),
    } as TSESTree.Token;
  }

  /**
   * get text
   */
  public getText(range: TSESTree.Range): string {
    return this.code.slice(range[0], range[1]);
  }

  public get originalAST(): any {
    return this.state.originalAST;
  }

  public set originalAST(originalAST: any) {
    this.state.originalAST = originalAST;
  }
}

export class LinesAndColumns {
  private readonly lineStartIndices: number[];

  private readonly code: string;

  public constructor(origCode: string) {
    const len = origCode.length;
    const lineStartIndices = [0];
    for (let index = 0; index < len; ) {
      const c = origCode[index++];
      if (c === "\r") {
        const next = origCode[index++] || "";
        if (next === "\n") {
          lineStartIndices.push(index);
        } else {
          lineStartIndices.push(index - 1);
        }
      } else {
        if (c === "\n") {
          lineStartIndices.push(index);
        }
      }
    }

    this.lineStartIndices = lineStartIndices;
    this.code = origCode;
  }

  public getLocFromIndex(index: number): { line: number; column: number } {
    const lineNumber = sortedLastIndex(
      this.lineStartIndices,
      (target) => target - index,
    );
    return {
      line: lineNumber,
      column: index - this.lineStartIndices[lineNumber - 1],
    };
  }

  public getIndexFromLoc(loc: { line: number; column: number }): number {
    const lineIndex = loc.line - 1;
    if (this.lineStartIndices.length > lineIndex) {
      const lineStartIndex = this.lineStartIndices[lineIndex];
      const positionIndex = lineStartIndex + loc.column;
      return positionIndex;
    } else if (this.lineStartIndices.length === lineIndex) {
      return this.code.length + loc.column;
    }
    return this.code.length + loc.column;
  }
}
