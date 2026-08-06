import { describe, expect, it, onTestFinished } from 'vitest';

import { createLogAction } from '../../src/utils/action';
import { MountedCardFactory, type MountedCard } from '../browser/mounted-card';
import {
  CARD_INITIALIZED_MESSAGE,
  createGenericCameraHASS,
  createInitializedAutomation,
  createStillImageCardConfig,
  deepQueryAll,
  getFocusedElement,
  pressKey,
  pressTab,
} from '../browser/test-utils';

// What the automation writes when it runs, written as the pattern the console
// is later searched for.
const KEY_MESSAGE = /key pressed/;

const mountCard = async (): Promise<MountedCard> => {
  const card = await MountedCardFactory.createFromSource(
    createStillImageCardConfig({
      automations: [
        createInitializedAutomation(),
        {
          triggers: [{ trigger: 'key', key: 'z' }],
          actions: [createLogAction(KEY_MESSAGE.source)],
        },
      ],
    }),
    createGenericCameraHASS(),
  );

  await card.events.waitForFirst('advanced-camera-card:media:loaded');

  return card;
};

/**
 * Tab until focus is past the card, however many places within it can take
 * focus. The bound is a runaway guard rather than a count, so that a card
 * which never lets focus go fails instead of tabbing forever; it is taken from
 * the card's own size, since nothing in it can be a tab stop twice.
 */
const tabPastCard = async (card: MountedCard): Promise<void> => {
  const bound = deepQueryAll(card.card, '*').length;

  // Tabbing starts from the top of the page, so the first press is the one
  // that reaches the card.
  await pressTab();

  for (
    let press = 0;
    press < bound && card.card.contains(document.activeElement);
    press++
  ) {
    await pressTab();
  }
};

/**
 * Something to tab on to after the card, standing in for whatever else is on
 * the dashboard below it.
 */
const addTrailingControl = (): HTMLElement => {
  const control = document.createElement('button');
  document.body.append(control);

  onTestFinished(() => control.remove());

  return control;
};

describe('CardElementManager', () => {
  it('should be reachable by tabbing', async () => {
    const card = await mountCard();

    // No pointer is used here at all. A card that can only be reached by
    // clicking on it is out of reach of a keyboard-only user.
    await pressTab();

    expect(getFocusedElement()).toBe(card.card);

    await pressKey('z');
    await card.console.waitForMessage(KEY_MESSAGE);
  });

  it('should be possible to tab beyond the card', async () => {
    const card = await mountCard();
    const trailingControl = addTrailingControl();

    await tabPastCard(card);

    // Tabbing continues past the card and out the other side. A card that kept
    // focus would strand a user part way down the dashboard.
    expect(getFocusedElement()).toBe(trailingControl);
  });

  it('should be reachable by tabbing after being put back in the document', async () => {
    const card = await mountCard();

    // Home Assistant takes a card out of the document when the dashboard tab it
    // is on is left, and puts the same element back on return.
    card.detach();
    card.attach();
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE, { count: 2 });

    await pressTab();

    expect(getFocusedElement()).toBe(card.card);

    await pressKey('z');
    await card.console.waitForMessage(KEY_MESSAGE);
  });
});
