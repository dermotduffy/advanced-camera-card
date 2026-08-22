import { describe, expect, it } from 'vitest';

import { deepQuery } from '../../browser/dom';
import { MountedCardFactory, type MountedCard } from '../../browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCardConfig,
} from '../../browser/test-utils';

const generateNotification = (card: MountedCard): void => {
  card.card.dispatchEvent(
    new CustomEvent('ll-custom', {
      bubbles: true,
      composed: true,
      detail: {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'notification',
        notification: {
          heading: { text: 'Heading', icon: 'mdi:information' },
        },
      },
    }),
  );
};

const isWithinViewport = (rect: DOMRect): boolean =>
  rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight;

// The `.notification` box inside the popup, but only once it is within the
// viewport, so a test can wait for the placement it asserts on.
const findVisibleNotification = (card: MountedCard): Element | null => {
  const notification = deepQuery(card.card, 'advanced-camera-card-notification');
  const box = notification ? deepQuery(notification, '.notification') : null;
  return box && isWithinViewport(box.getBoundingClientRect()) ? box : null;
};

describe('AdvancedCameraCardNotification', () => {
  it('should place the popup within the viewport on a card taller than it', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        dimensions: { height: `${window.innerHeight * 3}px` },
      }),
      createGenericCameraHASS(),
    );

    generateNotification(card);

    const box = await card.waitForRender(
      () => findVisibleNotification(card),
      'notification within the viewport',
    );

    expect(card.card.getBoundingClientRect().bottom).toBeGreaterThan(window.innerHeight);
    expect(isWithinViewport(box.getBoundingClientRect())).toBe(true);
  });

  it('should center the popup within the visible part of the card', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        dimensions: { height: `${window.innerHeight * 3}px` },
      }),
      createGenericCameraHASS(),
    );

    generateNotification(card);

    const box = await card.waitForRender(
      () => findVisibleNotification(card),
      'notification within the viewport',
    );

    // The pop-in animation translates the popup while it runs; measure only
    // once every animation on the popup has finished.
    await Promise.all(box.getAnimations().map((animation) => animation.finished));

    // The visible band runs from the card's top edge to the viewport bottom,
    // and the popup's center should sit at the band's center.
    const bandTop = card.card.getBoundingClientRect().top;
    const bandCenter = (bandTop + window.innerHeight) / 2;
    const rect = box.getBoundingClientRect();
    const popupCenter = (rect.top + rect.bottom) / 2;
    expect(Math.abs(popupCenter - bandCenter)).toBeLessThanOrEqual(2);
  });

  it('should not shrink the popup below its close control', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        dimensions: { height: `${window.innerHeight}px` },
      }),
      createGenericCameraHASS(),
      // Leave a sliver of the card on screen.
      { position: { top: `${window.innerHeight}px` } },
    );

    generateNotification(card);

    // Bring 20 pixels of the card's top edge into view at the bottom of the
    // viewport: far less room than the popup's minimum height.
    window.scrollTo(0, 20);

    await card.waitForRender(() => {
      const notification = deepQuery(card.card, 'advanced-camera-card-notification');
      const box = notification ? deepQuery(notification, '.notification') : null;
      const rect = box?.getBoundingClientRect();
      return rect &&
        rect.height >= 48 &&
        rect.top < window.innerHeight &&
        rect.bottom > 0
        ? box
        : null;
    }, 'a popup no smaller than its close control');
  });

  it('should keep the popup within the viewport while scrolling', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        dimensions: { height: `${window.innerHeight * 3}px` },
      }),
      createGenericCameraHASS(),
    );

    generateNotification(card);
    await card.waitForRender(
      () => findVisibleNotification(card),
      'notification within the viewport',
    );

    // Scroll the middle of the card into view, putting both its top and bottom
    // edges outside the viewport.
    window.scrollTo(0, window.innerHeight);

    const box = await card.waitForRender(
      () => findVisibleNotification(card),
      'notification within the viewport after scrolling',
    );
    expect(isWithinViewport(box.getBoundingClientRect())).toBe(true);
  });
});
