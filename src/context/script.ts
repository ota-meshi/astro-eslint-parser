import type { Context } from ".";
import { traverseNodes } from "../traverse";
import type { TSESTree } from "@typescript-eslint/types";
import type { ESLintExtendedProgram } from "../types";

class RestoreNodeProcessContext {
  public readonly result: ESLintExtendedProgram;

  public readonly removeTokens = new Set<(token: TSESTree.Token) => boolean>();

  private readonly parentMap: Map<TSESTree.Node, TSESTree.Node | null>;

  public constructor(
    result: ESLintExtendedProgram,
    parentMap: Map<TSESTree.Node, TSESTree.Node | null>
  ) {
    this.result = result;
    this.parentMap = parentMap;
  }

  public addRemoveToken(test: (token: TSESTree.Token) => boolean) {
    this.removeTokens.add(test);
  }

  public getParent(node: TSESTree.Node): TSESTree.Node | null {
    return this.parentMap.get(node) || null;
  }
}

export class ScriptContext {
  private readonly ctx: Context;

  public script = "";

  private consumedIndex = 0;

  private readonly offsets: { original: number; script: number }[] = [];

  private readonly fragments: { start: number; end: number }[] = [];

  private readonly tokens: TSESTree.Token[] = [];

  private readonly restoreNodeProcesses: ((
    node: TSESTree.Node,
    context: RestoreNodeProcessContext
  ) => boolean)[] = [];

  public constructor(ctx: Context) {
    this.ctx = ctx;
  }

  public get originalCode(): string {
    return this.ctx.code;
  }

  public skipOriginalOffset(offset: number): void {
    this.consumedIndex += offset;
  }

  public appendOriginal(index: number): void {
    if (this.consumedIndex >= index) {
      return;
    }
    this.offsets.push({
      original: this.consumedIndex,
      script: this.script.length,
    });
    this.script += this.ctx.code.slice(this.consumedIndex, index);
    this.consumedIndex = index;
  }

  public appendScript(fragment: string): void {
    const start = this.script.length;
    this.script += fragment;
    this.fragments.push({ start, end: this.script.length });
  }

  public addToken(type: TSESTree.Token["type"], range: TSESTree.Range): void {
    if (range[0] >= range[1]) {
      return;
    }
    this.tokens.push(this.ctx.buildToken(type, range));
  }

  public addRestoreNodeProcess(
    process: (
      node: TSESTree.Node,
      context: RestoreNodeProcessContext
    ) => boolean
  ): void {
    this.restoreNodeProcesses.push(process);
  }

  /**
   * Restore AST nodes
   */
  public restore(result: ESLintExtendedProgram): void {
    // remap locations
    const traversed = new Map<TSESTree.Node, TSESTree.Node | null>();
    traverseNodes(result.ast, {
      visitorKeys: result.visitorKeys,
      enterNode: (node, p) => {
        if (!traversed.has(node)) {
          traversed.set(node, p);

          this.remapLocation(node);
        }
      },
      leaveNode: (_node) => {
        // noop
      },
    });
    const tokens: TSESTree.Token[] = [...this.tokens];
    for (const token of result.ast.tokens || []) {
      if (
        this.fragments.some(
          (f) => f.start <= token.range[0] && token.range[1] <= f.end
        )
      ) {
        continue;
      }
      this.remapLocation(token);
      tokens.push(token);
    }
    result.ast.tokens = tokens;
    for (const token of result.ast.comments || []) {
      this.remapLocation(token);
    }

    const context = new RestoreNodeProcessContext(result, traversed);
    let restoreNodeProcesses = this.restoreNodeProcesses;
    for (const [node, parent] of traversed) {
      if (!parent) continue;
      restoreNodeProcesses = restoreNodeProcesses.filter(
        (proc) => !proc(node, context)
      );
    }

    if (context.removeTokens.size) {
      const tokens = result.ast.tokens || [];
      for (let index = tokens.length - 1; index >= 0; index--) {
        const token = tokens[index];
        for (const rt of context.removeTokens) {
          if (rt(token)) {
            tokens.splice(index, 1);
            context.removeTokens.delete(rt);
            if (!context.removeTokens.size) {
              break;
            }
          }
        }
      }
    }

    // Adjust program node location
    const firstOffset = Math.min(
      ...[result.ast.body[0], result.ast.tokens?.[0], result.ast.comments?.[0]]
        .filter(Boolean)
        .map((t) => t!.range[0])
    );
    if (firstOffset < result.ast.range[0]) {
      result.ast.range[0] = firstOffset;
      result.ast.loc.start = this.ctx.getLocFromIndex(firstOffset);
    }
  }

  private remapLocation(node: TSESTree.Node | TSESTree.Token): void {
    let [start, end] = node.range;
    const startFragment = this.fragments.find(
      (f) => f.start <= start && start < f.end
    );
    if (startFragment) {
      start = startFragment.end;
    }
    const endFragment = this.fragments.find(
      (f) => f.start < end && end <= f.end
    );
    if (endFragment) {
      end = endFragment.start;
    }

    if (end < start) {
      const w = start;
      start = end;
      end = w;
    }

    const locs = this.ctx.getLocations(...this.getRemapRange(start, end));

    node.loc = locs.loc;
    node.range = locs.range;

    if ((node as any).start != null) {
      delete (node as any).start;
    }
    if ((node as any).end != null) {
      delete (node as any).end;
    }
  }

  private getRemapRange(start: number, end: number): TSESTree.Range {
    if (!this.offsets.length) {
      return [start, end];
    }
    let lastStart = this.offsets[0];
    let lastEnd = this.offsets[0];
    for (const offset of this.offsets) {
      if (offset.script <= start) {
        lastStart = offset;
      }
      if (offset.script < end) {
        lastEnd = offset;
      } else {
        if (offset.script === end) {
          const remapStart = lastStart.original + (start - lastStart.script);
          if (
            this.tokens.some(
              (t) => t.range[0] <= remapStart && offset.original <= t.range[1]
            )
          ) {
            lastEnd = offset;
          }
        }
        break;
      }
    }

    const remapStart = lastStart.original + (start - lastStart.script);
    const remapEnd = lastEnd.original + (end - lastEnd.script);
    return [remapStart, remapEnd];
  }
}
