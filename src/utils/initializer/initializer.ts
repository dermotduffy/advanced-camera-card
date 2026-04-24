import { allPromises } from '../basic';

type InitializationCallback = () => Promise<void>;

/**
 * Manages initialization state & calling initializers. There is no guarantee
 * something will not be initialized twice unless there are concurrency controls
 * applied to the usage of this class.
 */
export class Initializer {
  private _initialized: Set<string> = new Set();

  public async initializeMultipleIfNecessary(
    aspects: Record<string, InitializationCallback>,
  ): Promise<void> {
    await allPromises(
      Object.entries(aspects),
      async ([aspect, options]) => await this.initializeIfNecessary(aspect, options),
    );
  }

  public async initializeIfNecessary(
    aspect: string,
    initializer?: InitializationCallback,
  ): Promise<void> {
    if (this._initialized.has(aspect)) {
      return;
    }
    if (initializer) {
      await initializer();
    }
    this._initialized.add(aspect);
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
