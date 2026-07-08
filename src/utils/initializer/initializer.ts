import { allPromises } from '../basic';

// An initializer returns `false` when it could not complete its work in this
// attempt; the aspect is then left uninitialized so a later attempt retries.
// Any other result marks the aspect initialized.
type InitializationCallback = () => Promise<boolean | void>;

/**
 * Manages initialization state and runs initializers.
 *
 * Safe when `uninitialize()` is called while an (async) initializer is still
 * running: that initializer's result is discarded instead of marking the aspect
 * initialized again. (Two initializers running for the same aspect at once is
 * still the caller's job to avoid.)
 */
export class Initializer {
  private _initialized: Set<string> = new Set();

  // Bumped on every `uninitialize()`. An `initializeIfNecessary()` captures the
  // generation before awaiting its initializer and, on completion, only records
  // success if the generation is unchanged -- i.e. no `uninitialize()` for that
  // aspect landed while it was running.
  private _generation: Map<string, number> = new Map();

  public async initializeMultipleIfNecessary(
    aspects: Record<string, InitializationCallback>,
  ): Promise<boolean> {
    const results = await allPromises(
      Object.entries(aspects),
      async ([aspect, options]) => await this.initializeIfNecessary(aspect, options),
    );
    return results.every(Boolean);
  }

  // Returns whether the aspect is initialized once this attempt completes.
  public async initializeIfNecessary(
    aspect: string,
    initializer?: InitializationCallback,
  ): Promise<boolean> {
    if (this._initialized.has(aspect)) {
      return true;
    }
    const generation = this._generation.get(aspect) ?? 0;
    if (initializer && (await initializer()) === false) {
      return false;
    }
    // If `uninitialize()` ran while we were awaiting, a newer attempt has taken
    // over -- throw this result away (don't mark it initialized) so a stale
    // result can't leave the card stuck, and a fresh attempt runs next time.
    if ((this._generation.get(aspect) ?? 0) !== generation) {
      return false;
    }
    this._initialized.add(aspect);
    return true;
  }

  public uninitialize(aspect: string): void {
    this._initialized.delete(aspect);
    this._generation.set(aspect, (this._generation.get(aspect) ?? 0) + 1);
  }

  public isInitialized(aspect: string): boolean {
    return this._initialized.has(aspect);
  }

  public isInitializedMultiple(aspects: string[]): boolean {
    return aspects.every((aspect) => this.isInitialized(aspect));
  }
}
