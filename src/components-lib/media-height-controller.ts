import { debounce, isEqual } from 'lodash-es';

export class MediaHeightController {
  private _host: HTMLElement;
  private _selector: string;

  private _root: HTMLElement | DocumentFragment | null = null;
  private _children: HTMLElement[] = [];
  private _selectedChild: HTMLElement | null = null;

  private _mutationObserver = new MutationObserver(() => this._initializeRoot());
  private _resizeObserver = new ResizeObserver(() => this._debouncedSetHeight());

  private _debouncedSetHeight = debounce(
    () => this._setHeight(),
    // Balancing act: Debounce to avoid excessive calls to setHeight, when new
    // media is loading the player may be a much smaller height momentarily.
    1000,
    {
      trailing: true,
      leading: false,
    },
  );

  constructor(host: HTMLElement, selector: string) {
    this._host = host;
    this._selector = selector;
  }

  public setRoot(root: HTMLElement | DocumentFragment): void {
    if (root === this._root) {
      return;
    }

    this._root = root;
    this._mutationObserver.disconnect();
    this._mutationObserver.observe(this._root, {
      childList: true,
    });
    this._initializeRoot();
  }

  public setSelected(selectedIndex: number): void {
    const selectedChild: HTMLElement | undefined = this._children[selectedIndex];
    if (!selectedChild || selectedChild === this._selectedChild) {
      return;
    }
    this._selectedChild = selectedChild;

    this._resizeObserver.disconnect();
    this._resizeObserver.observe(selectedChild);

    this._debouncedSetHeight();
  }

  public destroy(): void {
    this._mutationObserver.disconnect();
    this._resizeObserver.disconnect();

    this._root = null;
    this._children = [];
    this._selectedChild = null;
  }

  private _setHeight(): void {
    if (!this._selectedChild) {
      return;
    }

    const originalHeight = this._host.style.maxHeight;

    // Remove the height restriction to ensure the full max height. Example of
    // behavior without this: Chrome on Android will not correctly size if the
    // card is in fullscreen mode.
    this._host.style.maxHeight = '';

    // Calculate the true height.
    const selectedHeight = this._selectedChild.getBoundingClientRect().height;

    // Reset the original height so that browser transition animation can be
    // applied from the current to the target.
    this._host.style.maxHeight = originalHeight;

    // Force the browser to reflow.
    this._selectedChild.getBoundingClientRect();

    if (selectedHeight && !isNaN(selectedHeight) && selectedHeight > 0) {
      this._host.style.maxHeight = `${selectedHeight}px`;
    }
  }

  private _initializeRoot(): void {
    const children = [
      ...(this._root?.querySelectorAll<HTMLElement>(this._selector) ??
        /* istanbul ignore next: this path cannot be reached as root will always
        exist by the time the mutation observer is observing -- @preserve */
        []),
    ];
    if (isEqual(children, this._children)) {
      return;
    }

    this._children = children;
    this._selectedChild = null;
  }
}
