import { allPromises } from '../basic';

type InitializationCallback = () => Promise<boolean>;

/**
 * Manages initialization state & calling initializers. There is no guarantee
 * something will not be initialized twice unless there are concurrency controls
 * applied to the usage of this class.
 */
export class Initializer {
  private _initialized: Set<string> = new Set();

  public async initializeMultipleIfNecessary(
    aspects: Record<string, InitializationCallback>,
  ): Promise<boolean> {
    const results = await allPromises(
      Object.entries(aspects),
      async ([aspect, options]) => await this.initializeIfNecessary(aspect, options),
    );
    return results.every(Boolean);
  }

  public async initializeIfNecessary(
    aspect: string,
    initializer?: InitializationCallback,
  ): Promise<boolean> {
    if (this._initialized.has(aspect)) {
      return true;
    }
    if (!initializer) {
      this._initialized.add(aspect);
      return true;
    }
    if (await initializer()) {
      this._initialized.add(aspect);
      return true;
    }
    return false;
  }

  public uninitialize(aspect: string): void {
    this._initialized.delete(aspect);
  }

  public isInitialized(aspect: string): boolean {
    return this._initialized.has(aspect);
  }

  public isInitializedMultiple(aspects: string[]): boolean {
    return aspects.every((aspect) => this.isInitialized(aspect));
  }
}
