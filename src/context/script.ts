import type { Context } from ".";
import { RestoreContext } from "./restore";

export class VirtualScriptContext {
  private readonly originalCode: string;

  public readonly restoreContext: RestoreContext;

  public script = "";

  private consumedIndex = 0;

  public constructor(ctx: Context) {
    this.originalCode = ctx.code;
    this.restoreContext = new RestoreContext(ctx);
  }

  public skipOriginalOffset(offset: number): void {
    this.consumedIndex += offset;
  }

  public skipUntilOriginalOffset(offset: number): void {
    this.consumedIndex = Math.max(offset, this.consumedIndex);
  }

  public appendOriginal(index: number): void {
    if (this.consumedIndex >= index) {
      return;
    }
    this.restoreContext.addOffset({
      original: this.consumedIndex,
      dist: this.script.length,
    });
    this.script += this.originalCode.slice(this.consumedIndex, index);
    this.consumedIndex = index;
  }

  public appendVirtualScript(virtualFragment: string): void {
    const start = this.script.length;
    this.script += virtualFragment;
    this.restoreContext.addVirtualFragmentRange(start, this.script.length);
  }
}
