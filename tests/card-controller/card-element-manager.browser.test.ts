import { describe, expect, it, onTestFinished } from 'vitest';

import type { RawAdvancedCameraCardConfig } from '../../src/config/types';
import { createLogAction } from '../../src/utils/action';
import {
  deepQuery,
  deepQueryAll,
  getFocusedElement,
  pressKey,
  pressTab,
} from '../browser/dom';
import { MountedCardFactory, type MountedCard } from '../browser/mounted-card';
import {
  CARD_INITIALIZED_MESSAGE,
  createGenericCameraHASS,
  createInitializedAutomation,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  getBlockNotificationText,
  isLiveMediaShowing,
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

// The Home Assistant dialog the card is previewed in while its configuration is
// edited, which is what the card looks for before answering the editor's
// diagnostics button.
const EDIT_DIALOG_TAG_NAME = 'hui-dialog-edit-card';

const INIT_FAILED_ISSUE_HEADING = 'Initialization failed';

const DIAGNOSTICS_SELECTOR = 'advanced-camera-card-diagnostics';

const mountCardInEditDialog = async (
  config: RawAdvancedCameraCardConfig,
): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(config, createGenericCameraHASS(), {
    containerTagName: EDIT_DIALOG_TAG_NAME,
  });

/**
 * Press the editor's diagnostics button. The editor is elsewhere in the dialog
 * rather than within the card, so the event is fired from a sibling of it.
 */
const toggleDiagnostics = (card: MountedCard): void => {
  const editor = document.createElement('div');
  card.card.parentElement?.append(editor);

  editor.dispatchEvent(
    new CustomEvent('advanced-camera-card:editor:diagnostics', {
      bubbles: true,
      composed: true,
    }),
  );

  editor.remove();
};

const isDiagnosticsShowing = (card: MountedCard): boolean =>
  !!deepQuery(card.card, DIAGNOSTICS_SELECTOR);

describe('CardElementManager', () => {
  describe('should toggle diagnostics from the editor', () => {
    it('should show diagnostics over a card that could not be started', async () => {
      // A camera Home Assistant has never heard of, so the card cannot start
      // and shows an issue in place of its views.
      const card = await mountCardInEditDialog(
        createStillImageCardConfig({
          cameras: [createStillImageCameraConfig('camera.missing')],
          view: { issues: { retry_seconds: 0 } },
        }),
      );
      await card.waitForRender(
        () =>
          getBlockNotificationText(card.card).includes(INIT_FAILED_ISSUE_HEADING) ||
          null,
        'the initialization issue',
      );

      toggleDiagnostics(card);

      // Diagnostics is what the user is asked for when the card is broken, so
      // it must be reachable in the state the issue describes.
      await card.waitForSelector(DIAGNOSTICS_SELECTOR);
      expect(getBlockNotificationText(card.card)).not.toContain(
        INIT_FAILED_ISSUE_HEADING,
      );

      toggleDiagnostics(card);

      // Toggling diagnostics again just puts the issue back in front of the
      // user.
      await card.waitForRender(
        () =>
          getBlockNotificationText(card.card).includes(INIT_FAILED_ISSUE_HEADING) ||
          null,
        'the initialization issue',
      );
      expect(isDiagnosticsShowing(card)).toBe(false);
    });

    it('should return a started card to its default view', async () => {
      const card = await mountCardInEditDialog(createStillImageCardConfig());
      await card.events.waitForFirst('advanced-camera-card:media:loaded');

      toggleDiagnostics(card);
      await card.waitForSelector(DIAGNOSTICS_SELECTOR);

      toggleDiagnostics(card);

      await card.waitForRender(
        () => isLiveMediaShowing(card.card) || null,
        'the live view',
      );
      expect(isDiagnosticsShowing(card)).toBe(false);
    });
  });

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
