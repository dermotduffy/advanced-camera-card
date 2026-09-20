import { assert, describe, expect, it } from 'vitest';

import type { Notification } from '../../../src/config/schema/actions/types';
import { createLogAction } from '../../../src/utils/action';
import {
  clickElement,
  deepQuery,
  getFocusedElement,
  isFocusIndicatorDrawn,
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

const waitForNotificationRemoval = async (card: MountedCard): Promise<void> => {
  await card.waitForRender(
    () => (deepQuery(card.card, '.notification') ? null : true),
    'the notification to be removed',
  );
};

const dismissNotificationWithKeyboard = async (card: MountedCard): Promise<void> => {
  await pressKey('Escape');
  await waitForNotificationRemoval(card);
};

const dismissNotificationWithPointer = async (card: MountedCard): Promise<void> => {
  const close = deepQuery<HTMLElement>(card.card, 'button.close');
  assert(close);

  await clickElement(close);
  await waitForNotificationRemoval(card);
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

  it('should ARIA-label itself by its heading', async () => {
    const card = await mount();
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    const notification = await showNotification(card);

    expect(notification.getAttribute('role')).toBe('alertdialog');

    const labelledBy = notification.getAttribute('aria-labelledby');
    assert(labelledBy);
    expect(deepQuery(card.card, `#${labelledBy}`)?.textContent).toContain(
      NOTIFICATION.heading?.text,
    );
    expect(notification.hasAttribute('aria-label')).toBe(false);
  });

  it('should ARIA-label itself when it has no heading', async () => {
    const card = await mount({ body: { text: BODY_TEXT } });
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    const notification = await showNotification(card);

    expect(notification.getAttribute('aria-label')).toBe('Notification');
    expect(notification.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('should hand focus to the card once dismissed', async () => {
    const card = await mount();
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    const elsewhere = document.createElement('button');
    elsewhere.textContent = 'elsewhere';
    document.body.appendChild(elsewhere);
    await clickElement(elsewhere);

    await showNotification(card);
    await dismissNotificationWithKeyboard(card);

    // Notification returns focus back to the card.
    expect(getFocusedElement()).toBe(card.card);
  });

  it('should not draw an indicator on the card for a pointer user', async () => {
    const card = await mount();
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    await clickElement(await card.waitForSelector('advanced-camera-card-live-provider'));

    await showNotification(card);
    await dismissNotificationWithPointer(card);

    expect(getFocusedElement()).toBe(card.card);

    expect(isFocusIndicatorDrawn(card.card)).toBe(false);
  });

  it('should draw an indicator on the card for a keyboard user', async () => {
    const card = await mount();
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    await pressTab();
    expect(getFocusedElement()).toBe(card.card);
    expect(isFocusIndicatorDrawn(card.card)).toBe(true);

    await showNotification(card);
    await dismissNotificationWithKeyboard(card);

    expect(getFocusedElement()).toBe(card.card);

    expect(isFocusIndicatorDrawn(card.card)).toBe(true);
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
