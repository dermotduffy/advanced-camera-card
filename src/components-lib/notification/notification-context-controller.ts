import type * as JsYaml from 'js-yaml';
import type { ReactiveControllerHost } from 'lit';

import type { Notification } from '../../config/schema/actions/types.js';

// `js-yaml` (~107KB) is only needed to render a notification's diagnostic
// context when that context contains a structured object, which most cards
// never show. It is imported on demand and shared across every notification.
export class NotificationContextController {
  private static jsYamlDump: typeof JsYaml.dump | null = null;

  private _host: ReactiveControllerHost;

  constructor(host: ReactiveControllerHost) {
    this._host = host;
  }

  /**
   * Resolve a notification's context into display strings. String items pass
   * through unchanged; object items are YAML-dumped, loading `js-yaml` on
   * demand and re-rendering once it is ready. Returns an empty array while a
   * load needed for an object item is still in flight.
   */
  public getContext(notification: Notification): string[] {
    const context = notification.context ?? [];
    const dump = NotificationContextController.jsYamlDump;

    const result: string[] = [];
    for (const item of context) {
      if (typeof item === 'string') {
        result.push(item);
      } else if (dump) {
        result.push(dump(item));
      } else {
        // Object item needs js-yaml; load it and re-render once ready. A failed
        // load is swallowed: the notification renders without the dumped
        // context.
        this._loadDumper().catch(() => {});
        return [];
      }
    }
    return result;
  }

  private async _loadDumper(): Promise<void> {
    // `import()` is module-cached, so repeat/concurrent calls share one
    // download; a failed load is not cached, so a later render retries.
    const module = await import('js-yaml');
    NotificationContextController.jsYamlDump = module.dump;
    this._host.requestUpdate();
  }
}
