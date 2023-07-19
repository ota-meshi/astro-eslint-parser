import type { TSESTree } from "@typescript-eslint/types";
import type { Context } from ".";
import { traverseNodes } from "../traverse";
import type { ESLintExtendedProgram } from "../types";

/**
 * A function that restores the node.
 * @param node The node to restore.
 * @param result The result of parsing.
 * @returns
 *   If `false`, it indicates that the specified node was not processed.
 *
 *   If `true`, it indicates that the specified node was processed for processing.
 *   This process will no longer be called.
 */
type RestoreNodeProcess = (
  node: TSESTree.Node,
  context: RestoreNodeProcessContext,
) => boolean;

class RestoreNodeProcessContext {
  public readonly result: ESLintExtendedProgram;

  public readonly removeTokens = new Set<(token: TSESTree.Token) => boolean>();

  private readonly nodeMap: Map<TSESTree.Node, TSESTree.Node | null>;

  public constructor(
    result: ESLintExtendedProgram,
    nodeMap: Map<TSESTree.Node, TSESTree.Node | null>,
  ) {
    this.result = result;
    this.nodeMap = nodeMap;
  }

  public addRemoveToken(test: (token: TSESTree.Token) => boolean) {
    this.removeTokens.add(test);
  }

  public getParent(node: TSESTree.Node): TSESTree.Node | null {
    return this.nodeMap.get(node) || null;
  }
}

export class RestoreContext {
  private readonly ctx: Context;

  private readonly offsets: { original: number; dist: number }[] = [];

  private readonly virtualFragments: { start: number; end: number }[] = [];

  private readonly restoreNodeProcesses: RestoreNodeProcess[] = [];

  private readonly tokens: TSESTree.Token[] = [];

  public constructor(ctx: Context) {
    this.ctx = ctx;
  }

  public addRestoreNodeProcess(process: RestoreNodeProcess): void {
    this.restoreNodeProcesses.push(process);
  }

  public addOffset(offset: { original: number; dist: number }): void {
    this.offsets.push(offset);
  }

  public addVirtualFragmentRange(start: number, end: number): void {
    const peek = this.virtualFragments[this.virtualFragments.length - 1];
    if (peek && peek.end === start) {
      peek.end = end;
      return;
    }
    this.virtualFragments.push({ start, end });
  }

  public addToken(type: TSESTree.Token["type"], range: TSESTree.Range): void {
    if (range[0] >= range[1]) {
      return;
    }
    this.tokens.push(this.ctx.buildToken(type, range));
  }

  /**
   * Restore AST nodes
   */
  public restore(result: ESLintExtendedProgram): void {
    const nodeMap = remapLocationsAndGetNodeMap(result, this.tokens, {
      remapLocation: (n) => this.remapLocation(n),
      removeToken: (token) =>
        this.virtualFragments.some(
          (f) => f.start <= token.range[0] && token.range[1] <= f.end,
        ),
    });

    restoreNodes(result, nodeMap, this.restoreNodeProcesses);

    // Adjust program node location
    const firstOffset = Math.min(
      ...[result.ast.body[0], result.ast.tokens?.[0], result.ast.comments?.[0]]
        .filter((t): t is NonNullable<typeof t> => Boolean(t))
        .map((t) => t.range[0]),
    );
    if (firstOffset < result.ast.range[0]) {
      result.ast.range[0] = firstOffset;
      result.ast.loc.start = this.ctx.getLocFromIndex(firstOffset);
    }
  }

  private remapLocation(node: TSESTree.Node | TSESTree.Token): void {
    let [start, end] = node.range;
    const startFragment = this.virtualFragments.find(
      (f) => f.start <= start && start < f.end,
    );
    if (startFragment) {
      start = startFragment.end;
    }
    const endFragment = this.virtualFragments.find(
      (f) => f.start < end && end <= f.end,
    );
    if (endFragment) {
      end = endFragment.start;
      if (startFragment === endFragment) {
        start = startFragment.start;
      }
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
      if (offset.dist <= start) {
        lastStart = offset;
      }
      if (offset.dist < end) {
        lastEnd = offset;
      } else {
        if (offset.dist === end && start === end) {
          lastEnd = offset;
        }
        break;
      }
    }

    const remapStart = lastStart.original + (start - lastStart.dist);
    const remapEnd = lastEnd.original + (end - lastEnd.dist);
    if (remapEnd < remapStart) {
      return [remapEnd, remapStart];
    }
    return [remapStart, remapEnd];
  }
}

/** Restore locations */
function remapLocationsAndGetNodeMap(
  result: ESLintExtendedProgram,
  restoreTokens: TSESTree.Token[],
  {
    remapLocation,
    removeToken,
  }: {
    remapLocation: (node: TSESTree.Node | TSESTree.Token) => void;
    removeToken: (node: TSESTree.Token) => boolean;
  },
) {
  const traversed = new Map<TSESTree.Node, TSESTree.Node | null>();
  // remap locations
  traverseNodes(result.ast, {
    visitorKeys: result.visitorKeys,
    enterNode: (node, p) => {
      if (!traversed.has(node)) {
        traversed.set(node, p);

        remapLocation(node);
      }
    },
    leaveNode: (_node) => {
      // noop
    },
  });
  const tokens: TSESTree.Token[] = [...restoreTokens];
  for (const token of result.ast.tokens || []) {
    if (removeToken(token)) {
      continue;
    }
    remapLocation(token);
    tokens.push(token);
  }
  result.ast.tokens = tokens;
  for (const token of result.ast.comments || []) {
    remapLocation(token);
  }

  return traversed;
}

/** Restore nodes */
function restoreNodes(
  result: ESLintExtendedProgram,
  nodeMap: Map<TSESTree.Node, TSESTree.Node | null>,
  restoreNodeProcesses: RestoreNodeProcess[],
) {
  const context = new RestoreNodeProcessContext(result, nodeMap);
  const restoreNodeProcessesSet = new Set(restoreNodeProcesses);
  for (const [node] of nodeMap) {
    if (!restoreNodeProcessesSet.size) {
      break;
    }
    for (const proc of [...restoreNodeProcessesSet]) {
      if (proc(node, context)) {
        restoreNodeProcessesSet.delete(proc);
      }
    }
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
}
