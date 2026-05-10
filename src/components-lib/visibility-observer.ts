type VisibilityChangeHandler = (visible: boolean) => Promise<void> | void;

/**
 * Observes a root element's visibility, emitting a single boolean whenever it
 * transitions. The element is "visible" only when both:
 *
 *  - The document's tab is visible (`document.visibilityState === 'visible'`).
 *  - The element is intersecting the viewport.
 *
 * Tab visibility alone is not sufficient: a preloaded element can remain in the
 * DOM but hidden (e.g. `display: none`) while the user is on a different view.
 * In that case the tab can become visible without the element being shown, and
 * consumers (e.g. microphone auto-unmute) must not act on it.
 *
 * Emission rules: the first IntersectionObserver callback establishes the
 * baseline and does not emit. Tab visibility events arriving before that first
 * callback are no-ops (we don't yet know whether the element is in viewport).
 * Once baseline is established, any subsequent change emits.
 */
export class VisibilityObserver {
  private _root: HTMLElement | null = null;
  private _intersecting: boolean | null = null;
  private _lastEmitted: boolean | null = null;
  private _intersectionObserver = new IntersectionObserver(
    this._handleIntersection.bind(this),
  );
  private _onChange: VisibilityChangeHandler;

  constructor(onChange: VisibilityChangeHandler) {
    this._onChange = onChange;
    document.addEventListener('visibilitychange', this._handleVisibility);
  }

  public setRoot(root: HTMLElement): void {
    if (root === this._root) {
      return;
    }
    this._root = root;
    // Reset so the first callback for the new root is the new baseline
    // (not compared against the previous root's state).
    this._intersecting = null;
    this._lastEmitted = null;
    this._intersectionObserver.disconnect();
    this._intersectionObserver.observe(root);
  }

  public destroy(): void {
    this._root = null;
    this._intersecting = null;
    this._lastEmitted = null;
    this._intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', this._handleVisibility);
  }

  private async _handleIntersection(
    entries: IntersectionObserverEntry[],
  ): Promise<void> {
    this._intersecting = entries.some((entry) => entry.isIntersecting);
    await this._evaluate();
  }

  private _handleVisibility = async (): Promise<void> => {
    await this._evaluate();
  };

  private async _evaluate(): Promise<void> {
    // Wait for the IntersectionObserver to fire at least once before emitting
    // anything. Otherwise tab visibility events arriving between observer
    // construction and `setRoot` would emit with no real knowledge of whether
    // the element is shown to the user.
    if (this._intersecting === null) {
      return;
    }

    const visible = document.visibilityState === 'visible' && this._intersecting;

    if (this._lastEmitted === null) {
      // First time we have an intersection value: this is the baseline. Record
      // and return without emitting.
      this._lastEmitted = visible;
      return;
    }
    if (visible === this._lastEmitted) {
      return;
    }
    this._lastEmitted = visible;
    await this._onChange(visible);
  }
}
