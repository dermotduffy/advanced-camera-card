import { Issue, IssueDescription, IssueKey } from '../types.js';

// Shared base for issues whose only state is a single triggered error. Subclasses
// define the key and how an error renders; the base handles trigger/reset and
// gates getIssue() on error presence.
export abstract class AbstractErrorIssue implements Issue {
  public abstract readonly key: IssueKey;
  protected _error: unknown = null;

  public trigger(context: { error: unknown }): void {
    this._error = context.error ?? null;
  }

  public hasIssue(): boolean {
    return this._error !== null;
  }

  public getIssue(): IssueDescription | null {
    if (this._error == null) {
      return null;
    }
    return this._buildDescription(this._error);
  }

  public reset(): void {
    this._error = null;
  }

  protected abstract _buildDescription(error: NonNullable<unknown>): IssueDescription;
}
