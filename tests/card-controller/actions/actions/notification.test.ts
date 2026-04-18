import { describe, expect, it } from 'vitest';
import { NotificationAction } from '../../../../src/card-controller/actions/actions/notification';
import { createCardAPI } from '../../../test-utils';

describe('NotificationAction', () => {
  it('should set notification on manager', async () => {
    const api = createCardAPI();
    const notification = {
      heading: { text: 'Test Heading' },
      text: 'Test text',
    };

    const action = new NotificationAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'notification',
        notification,
      },
    );

    await action.execute(api);

    expect(api.getNotificationManager().setNotification).toHaveBeenCalledWith(
      notification,
    );
  });
});
