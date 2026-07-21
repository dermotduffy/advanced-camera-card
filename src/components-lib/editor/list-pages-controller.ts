import type { ReactiveController, ReactiveControllerHost } from 'lit';

// One step of the path into the editor: which list was drilled into, and the
// position within it of the item opened.
interface ListPage {
  list: string;
  index: number;
}

/**
 * The path of list items the user has drilled into. An empty path is the top
 * list itself; each further step names the list entered and the item's position
 * in it, so `[{list: 'cameras', index: 2}, {list: 'events', index: 0}]` is the
 * first event of the third camera.
 *
 * Only one step is shown at a time, so opening an item replaces the list rather
 * than expanding within it.
 */
export class ListPagesController implements ReactiveController {
  private _host: ReactiveControllerHost;
  private _path: ListPage[] = [];

  constructor(host: ReactiveControllerHost) {
    this._host = host;
    host.addController(this);
  }

  public hostConnected(): void {
    // No connection-time work.
  }

  public getPath(): readonly ListPage[] {
    return this._path;
  }

  public open(list: string, index: number): void {
    this._path = [...this._path, { list, index }];
    this._host.requestUpdate();
  }

  public back(): void {
    if (!this._path.length) {
      return;
    }
    this._path = this._path.slice(0, -1);
    this._host.requestUpdate();
  }
}
