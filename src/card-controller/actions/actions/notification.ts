import { NotificationActionConfig } from '../../../config/schema/actions/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class NotificationAction extends AdvancedCameraCardAction<NotificationActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);
    api.getNotificationManager().setNotification(this._action.notification);
  }
}
