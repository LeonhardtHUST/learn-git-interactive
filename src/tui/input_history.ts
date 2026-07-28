/** 命令行历史浏览状态；与 OpenTUI 组件解耦，便于覆盖边界行为。 */
export class CommandHistoryNavigator {
  private index = -1;
  private draft = "";

  reset(): void {
    this.index = -1;
    this.draft = "";
  }

  previous(history: readonly string[], current: string): string | undefined {
    if (!history.length) return undefined;
    if (this.index < 0) this.draft = current;
    this.index = Math.min(history.length - 1, this.index + 1);
    return history[history.length - 1 - this.index];
  }

  next(history: readonly string[]): string | undefined {
    if (this.index < 0) return undefined;
    this.index -= 1;
    return this.index < 0 ? this.draft : history[history.length - 1 - this.index];
  }
}
