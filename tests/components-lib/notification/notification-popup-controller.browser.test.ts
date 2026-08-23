import { describe, expect, it } from 'vitest';

import type { Notification } from '../../../src/config/schema/actions/types';
import { createLogAction } from '../../../src/utils/action';
import {
  clickElement,
  deepQuery,
  getFocusedElement,
  pressKey,
  pressTab,
} from '../../browser/dom';
import { MountedCardFactory, type MountedCard } from '../../browser/mounted-card';
import {
  CARD_INITIALIZED_MESSAGE,
  createGenericCameraHASS,
  createInitializedAutomation,
  createStillImageCardConfig,
} from '../../browser/test-utils';

const TRIGGER_ENTITY = 'input_boolean.notify';

const BODY_TEXT = 'This camera does not support two-way audio.';

const CONTROL_TAPPED_MESSAGE = /control tapped/;

const NOTIFICATION: Notification = {
  heading: { text: 'Two-way audio unavailable' },
  body: { text: BODY_TEXT },
};

const mount = async (
  notification: Notification = NOTIFICATION,
): Promise<MountedCard> => {
  const hass = createGenericCameraHASS({ entities: { [TRIGGER_ENTITY]: 'off' } });
  return await MountedCardFactory.createFromSource(
    createStillImageCardConfig({
      automations: [
        createInitializedAutomation(),
        {
          triggers: [{ trigger: 'state', entity: TRIGGER_ENTITY, to: 'on' }],
          actions: [
            {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'notification',
              notification,
            },
          ],
        },
      ],
    }),
    hass,
  );
};

const showNotification = async (card: MountedCard): Promise<HTMLElement> => {
  card.setEntityState(TRIGGER_ENTITY, 'on');
  return await card.waitForSelector<HTMLElement>('.notification');
};

describe('NotificationPopupController', () => {
  it('should keep the notification open when its own text is pressed', async () => {
    const card = await mount();
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    const notification = await showNotification(card);

    const body = deepQuery<HTMLElement>(card.card, '.detail.body span');
    expect(body?.textContent).toBe(BODY_TEXT);
    if (!body) {
      return;
    }

    await clickElement(body);

    expect(notification.classList.contains('exiting')).toBe(false);
  });

  it('should dismiss the notification when the page outside it is pressed', async () => {
    const card = await mount();
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    const outside = document.createElement('button');
    outside.textContent = 'outside';
    document.body.appendChild(outside);

    const notification = await showNotification(card);
    expect(notification.classList.contains('exiting')).toBe(false);

    await clickElement(outside);

    expect(notification.classList.contains('exiting')).toBe(true);
  });

  it('should take focus when notification is opened', async () => {
    const card = await mount();
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    const notification = await showNotification(card);

    expect(getFocusedElement()).toBe(notification);
  });

  it('should move focus to its close control on Tab', async () => {
    const card = await mount();
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    await showNotification(card);
    const close = deepQuery<HTMLElement>(card.card, 'button.close');
    expect(close).toBeTruthy();

    await pressTab();

    expect(getFocusedElement()).toBe(close);
  });

  it('should return focus to where it was once dismissed', async () => {
    const card = await mount();
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    await showNotification(card);
    expect(getFocusedElement()).not.toBe(elsewhere);

    await pressKey('Escape');
    await card.waitForRender(
      () => (deepQuery(card.card, '.notification') ? null : true),
      'the notification to be removed',
    );

    expect(getFocusedElement()).toBe(elsewhere);
  });

  it('should activate a notification control from the keyboard', async () => {
    const card = await mount({
      ...NOTIFICATION,
      controls: [
        {
          icon: 'mdi:refresh',
          tooltip: 'Retry',
          dismiss: true,
          actions: { tap_action: createLogAction(CONTROL_TAPPED_MESSAGE.source) },
        },
      ],
    });
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    await showNotification(card);

    await pressTab();
    expect(getFocusedElement()).toBe(deepQuery(card.card, '.notification .control'));

    await pressKey('Enter');

    await card.console.waitForMessage(CONTROL_TAPPED_MESSAGE);
  });
});
