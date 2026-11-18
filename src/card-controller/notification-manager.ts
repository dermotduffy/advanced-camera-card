import type { ReadonlyDeep } from 'type-fest';

import type { Notification } from '../config/schema/actions/types';
import type { CardNotificationAPI } from './types';

export class NotificationManager {
  private _notification: ReadonlyDeep<Notification> | null = null;
  private _api: CardNotificationAPI;

  constructor(api: CardNotificationAPI) {
    this._api = api;
  }

  public getNotification(): ReadonlyDeep<Notification> | null {
    return this._notification;
  }

  public hasNotification(): boolean {
    return this._notification !== null;
  }

  // Also used to replace the current notification in-place (e.g. to refresh
  // control state after a toggle action).
  public setNotification(notification: ReadonlyDeep<Notification>): void {
    this._notification = notification;
    this._api.getCardElementManager().update();
  }

  public reset(): void {
    if (this._notification) {
      this._notification = null;
      this._api.getCardElementManager().update();
    }
  }
}
