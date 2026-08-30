import { assert, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  STEP_DELAY_SECONDS,
  STEP_PAN,
} from '../../src/card-controller/actions/actions/ptz-digital';
import type { ZoomSettingsObserved } from '../../src/components-lib/zoom/types';
import type { LogActionConfig } from '../../src/config/schema/actions/custom/log';
import { createLogAction } from '../../src/utils/action';
import { isRecord } from '../../src/utils/basic';
import {
  clickElement,
  dispatchPointerDown,
  getFocusedElement,
  holdKey,
  pressKey,
  pressTab,
  releaseKey,
} from '../browser/dom';
import {
  MountedCardFactory,
  type MountedCard,
  type MountOptions,
} from '../browser/mounted-card';
import {
  CARD_INITIALIZED_MESSAGE,
  createGenericCameraHASS,
  createInitializedAutomation,
  createStillImageCardConfig,
} from '../browser/test-utils';

const ZOOM_ENTITY = 'input_boolean.zoom';

// What each automation writes when it runs, written as the pattern the console
// is later searched for. The console is the only place a `log` action reports
// to, and a message that names the automation is what makes one key press
// distinguishable from another.
const KEY_MESSAGE = /plain key press/;
const OTHER_CARD_KEY_MESSAGE = /key press on the other card/;
const CTRL_KEY_MESSAGE = /key press with ctrl held/;
const KEY_DOWN_MESSAGE = /key on the way down/;
const KEY_UP_MESSAGE = /key on the way up/;
const MENU_BUTTON_MESSAGE = /menu button pressed/;

const MENU_BUTTON_CONTROL = 'Log';
const EXPAND_CONTROL = 'Expand';

// The card's own builder, given the text its pattern matches.
const logAction = (regexp: RegExp): LogActionConfig => createLogAction(regexp.source);

interface MountCardOptions extends MountOptions {
  // What a plain key press logs, so that a test with two cards on the page can
  // tell which of them answered.
  keyMessage?: RegExp;
}

const mountCard = async (options?: MountCardOptions): Promise<MountedCard> => {
  const { keyMessage, ...mountOptions } = options ?? {};

  const card = await MountedCardFactory.createFromSource(
    createStillImageCardConfig({
      menu: { style: 'outside', buttons: { expand: { enabled: true } } },
      elements: [
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
          title: MENU_BUTTON_CONTROL,
          tap_action: logAction(MENU_BUTTON_MESSAGE),
        },
      ],
      automations: [
        createInitializedAutomation(),
        {
          triggers: [{ trigger: 'key', key: 'z' }],
          actions: [logAction(keyMessage ?? KEY_MESSAGE)],
        },
        {
          triggers: [{ trigger: 'key', key: 'b', ctrl: true }],
          actions: [logAction(CTRL_KEY_MESSAGE)],
        },
        {
          triggers: [{ trigger: 'key', key: 'w', state: 'down' }],
          actions: [logAction(KEY_DOWN_MESSAGE)],
        },
        {
          triggers: [{ trigger: 'key', key: 'w', state: 'up' }],
          actions: [logAction(KEY_UP_MESSAGE)],
        },
        // A key whose action redraws the card, so a test can press a key, have
        // the picture replaced under it, and press again.
        {
          triggers: [{ trigger: 'key', key: '1' }],
          actions: [
            {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'ptz_digital',
              absolute: { zoom: 3 },
            },
          ],
        },

        // The same zoom driven by an entity rather than a key, so a test can
        // zoom the card without pressing or clicking it first. A zoomed
        // picture takes a press as the start of a pan, which is what such a
        // test is about.
        {
          triggers: [{ trigger: 'state', entity: ZOOM_ENTITY, to: 'on' }],
          actions: [
            {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'ptz_digital',
              absolute: { zoom: 3 },
            },
          ],
        },
      ],
    }),
    createGenericCameraHASS({ entities: { [ZOOM_ENTITY]: 'off' } }),
    mountOptions,
  );

  await card.events.waitForFirst('advanced-camera-card:media:loaded');

  return card;
};

const isZoomSettingsObserved = (detail: unknown): detail is ZoomSettingsObserved =>
  isRecord(detail) && isRecord(detail.pan) && typeof detail.pan.x === 'number';

// How far across and down the camera the picture sits, as percentages, from the
// last change the card reported. It starts halfway on both.
const getPan = (card: MountedCard): { x: number; y: number } | null => {
  const detail = card.events
    .getEntries('advanced-camera-card:zoom:change')
    .at(-1)?.detail;
  return isZoomSettingsObserved(detail) ? detail.pan : null;
};

// A count of step-timer periods (STEP_DELAY_SECONDS each) to run the clock
// forward. A movement still running takes one step per period, so any count
// above the single late step the assertion tolerates would do; three is a
// comfortable margin.
const STEPS_TO_PROVE_STOPPED = 3;

// The card reports a change per step taken, so counting the changes says
// whether a movement is still going, rather than where it has got to.
const countPanSteps = (card: MountedCard): number =>
  card.events.getEntries('advanced-camera-card:zoom:change').length;

// Assert a movement has stopped by running the step timer several periods
// forward and checking no further steps are taken.
const expectPanStopped = async (card: MountedCard): Promise<void> => {
  const steps = countPanSteps(card);

  await card.advanceSeconds(STEP_DELAY_SECONDS * STEPS_TO_PROVE_STOPPED);

  // The one step already scheduled when the movement stopped is allowed; a
  // movement still going would take several more.
  expect(countPanSteps(card)).toBeLessThanOrEqual(steps + 1);
};

// What the live view draws the camera into, which is the part of the card a
// user looks at and the largest part of it that is not a control.
const LIVE_MEDIA_SELECTOR = 'advanced-camera-card-live-provider';

const clickMedia = async (card: MountedCard): Promise<void> =>
  await clickElement(await card.waitForSelector(LIVE_MEDIA_SELECTOR));

describe('KeyboardStateManager', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('should not act on a key until the card has been used', async () => {
    const card = await mountCard();

    // A key press belongs to whatever the user is looking at. A card that
    // answered one aimed at something else on the dashboard would fire
    // shortcuts nobody asked for.
    await pressKey('z');

    await clickMedia(card);
    await pressKey('z');
    await card.console.waitForMessage(KEY_MESSAGE);

    // Once, from the press after the card was used. The first press is what
    // this test is about, and only counting says it was ignored rather than
    // merely slow.
    expect(card.console.countMessages(KEY_MESSAGE)).toBe(1);
  });

  it('should keep receiving keys after an action has redrawn the card', async () => {
    const card = await mountCard();

    await clickMedia(card);

    // The zoom replaces what is on screen, and the card is drawn again around
    // it. Anything holding focus below the card would be thrown away here.
    await pressKey('1');
    await card.events.waitForFirst('advanced-camera-card:zoom:zoomed');

    await pressKey('z');
    await card.console.waitForMessage(KEY_MESSAGE);
  });

  it('should keep receiving keys after a menu button has been pressed', async () => {
    const card = await mountCard();

    await card.clickControl(MENU_BUTTON_CONTROL);

    // The button did what it was asked, so nothing about claiming focus
    // swallowed the press on its way in.
    await card.console.waitForMessage(MENU_BUTTON_MESSAGE);

    await pressKey('z');
    await card.console.waitForMessage(KEY_MESSAGE);
  });

  it('should claim focus from a press that is consumed by the card', async () => {
    const card = await mountCard();

    card.setEntityState(ZOOM_ENTITY, 'on');
    await card.events.waitForFirst('advanced-camera-card:zoom:zoomed');

    // A press on a zoomed picture is taken as the start of a pan: it is kept
    // from reaching anything else, and the browser is told not to do what it
    // would normally do with it, which includes moving focus.
    await clickMedia(card);

    expect(getFocusedElement()).toBe(card.card);

    await pressKey('z');
    await card.console.waitForMessage(KEY_MESSAGE);
  });

  it('should not draw a focus indicator when it takes focus', async () => {
    const card = await mountCard();

    await clickMedia(card);

    expect(getFocusedElement()).toBe(card.card);

    // Focus taken by script counts as keyboard-driven, and the browser rings
    // the whole card for it: a bright border around a card the user only
    // pressed.
    expect(card.card.matches(':focus-visible')).toBe(false);
  });

  it('should draw a focus indicator when it is reached with the keyboard', async () => {
    const card = await mountCard();

    await pressTab();

    expect(getFocusedElement()).toBe(card.card);

    // The card is in the tab order, and a user who arrives on it that way needs
    // to be able to see where they are.
    expect(card.card.matches(':focus-visible')).toBe(true);
  });

  it('should not scroll the page when it takes focus', async () => {
    // Well below the window, so the card is out of sight until the page is
    // scrolled to it.
    const card = await mountCard({ position: { top: '2000px' } });

    window.scrollTo(0, 0);

    // Pressed without a pointer: a real one is moved to what it presses, and
    // where the page ends up is the thing being asserted on here.
    dispatchPointerDown(await card.waitForSelector(LIVE_MEDIA_SELECTOR));

    // The card is far below what is on screen. A user pressing a card they can
    // only see part of would find the dashboard jumping under them.
    expect(window.scrollY).toBe(0);

    expect(getFocusedElement()).toBe(card.card);
  });

  it('should leave focus where it is when it is already inside the card', async () => {
    const card = await mountCard();

    await card.clickControl(MENU_BUTTON_CONTROL);
    await card.console.waitForMessage(MENU_BUTTON_MESSAGE);

    // Pressing a control puts focus on it rather than on the card around it,
    // which is the situation this test is about.
    const control = getFocusedElement();
    assert(control);
    expect(control).not.toBe(card.card);

    let lostFocus = false;
    control.addEventListener('focusout', () => (lostFocus = true));

    await card.clickControl(MENU_BUTTON_CONTROL);
    await card.console.waitForMessage(MENU_BUTTON_MESSAGE, { count: 2 });

    // Taking focus off a control the user is working in is how a field being
    // typed into loses what is in it, or a picker closes mid-choice.
    expect(lostFocus).toBe(false);
    expect(getFocusedElement()).toBe(control);
  });

  it('should hold on to a held key while a control in the card is pressed', async () => {
    const card = await mountCard();

    await clickMedia(card);

    await holdKey('w');
    await card.console.waitForMessage(KEY_DOWN_MESSAGE);

    // Focus moves from the card to the button within it, which is not the user
    // letting go of the key.
    await card.clickControl(MENU_BUTTON_CONTROL);
    await card.console.waitForMessage(MENU_BUTTON_MESSAGE);

    // A key whose press was forgotten has no release either, which is what
    // leaves a camera panning with nothing to stop it.
    await releaseKey('w');
    await card.console.waitForMessage(KEY_UP_MESSAGE);
  });

  it('should act on a key only when its modifiers match', async () => {
    const card = await mountCard();

    await clickMedia(card);

    await pressKey('b');

    // The trigger calls the modifier `ctrl`; the keyboard calls the key
    // `Control`.
    await holdKey('Control');
    await pressKey('b');
    await releaseKey('Control');
    await card.console.waitForMessage(CTRL_KEY_MESSAGE);

    // The press without the modifier is a different shortcut, and one this card
    // has nothing configured for.
    expect(card.console.countMessages(CTRL_KEY_MESSAGE)).toBe(1);
  });

  it('should keep receiving keys while expanded', async () => {
    const card = await mountCard();

    await card.clickControl(EXPAND_CONTROL);

    // The whole card is drawn again inside a dialog, which is as large a
    // change as anything that happens to it.
    await card.waitForSelector('web-dialog');

    await clickMedia(card);
    await pressKey('z');
    await card.console.waitForMessage(KEY_MESSAGE);
  });

  it('should stop receiving keys once it is taken out of the document', async () => {
    const card = await mountCard();

    await clickMedia(card);
    await pressKey('z');
    await card.console.waitForMessage(KEY_MESSAGE);

    card.detach();

    // A card on a dashboard tab that is not being looked at is out of the
    // document, and answering keys from there would run shortcuts on a card
    // nobody can see.
    await pressKey('z');
    expect(card.console.countMessages(KEY_MESSAGE)).toBe(1);

    card.attach();

    // The card builds itself again from nothing on its return, and answers
    // nothing until it has.
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE, { count: 2 });

    await clickMedia(card);
    await pressKey('z');
    await card.console.waitForMessage(KEY_MESSAGE, { count: 2 });
  });

  // See: https://github.com/dermotduffy/advanced-camera-card/issues/2623
  it('should keep panning while an arrow key is held after previous press', async () => {
    const card = await mountCard();

    card.setEntityState(ZOOM_ENTITY, 'on');
    await card.events.waitForFirst('advanced-camera-card:zoom:zoomed');
    await clickMedia(card);

    // Press a key to ensure holds after initial press are functional.
    await pressKey('ArrowUp');

    //`shouldAdvanceTime` lets the clock run at its own pace until "controlled",
    // necessary for the panning while a key is being "held" to work.
    vi.useFakeTimers({ shouldAdvanceTime: true });

    await holdKey('ArrowLeft');
    await card.waitForRender(() => {
      const x = getPan(card)?.x ?? null;

      // Stop well short of the left edge, to allow detection of continuous pan
      // that never stopped.
      return x !== null && x < 40 ? x : null;
    }, 'the picture to pan left');
    await releaseKey('ArrowLeft');

    await expectPanStopped(card);
  });

  // See: https://github.com/dermotduffy/advanced-camera-card/issues/2668
  it('should keep panning for a held key when another key is released', async () => {
    const card = await mountCard();

    card.setEntityState(ZOOM_ENTITY, 'on');
    await card.events.waitForFirst('advanced-camera-card:zoom:zoomed');
    await clickMedia(card);

    //`shouldAdvanceTime` lets the clock run at its own pace until "controlled",
    // necessary for the panning while a key is being "held" to work.
    vi.useFakeTimers({ shouldAdvanceTime: true });

    await holdKey('ArrowUp');
    await card.waitForRender(() => {
      const y = getPan(card)?.y ?? null;
      return y !== null && y < 50 ? y : null;
    }, 'the picture to pan up');

    // The left key is pressed while the up key is still held, which takes the
    // movement over from it.
    await holdKey('ArrowLeft');
    await card.waitForRender(() => {
      const x = getPan(card)?.x ?? null;
      return x !== null && x < 50 ? x : null;
    }, 'the picture to pan left');

    const atRelease = getPan(card);
    assert(atRelease !== null);

    await releaseKey('ArrowUp');

    // The left key is still held, so the picture keeps moving left. A user who
    // lets go of one arrow key while holding another expects the camera to
    // carry on in the direction they are still requesting.
    await card.waitForRender(() => {
      const x = getPan(card)?.x ?? null;
      return x !== null && x < atRelease.x - STEP_PAN ? x : null;
    }, 'the picture to keep panning left');

    await releaseKey('ArrowLeft');

    const atStop = getPan(card);
    assert(atStop !== null);

    // The pan must stop with room to spare before the left edge, so
    // expectPanStopped below can tell a stopped pan from a moving one.
    expect(atStop.x).toBeGreaterThan(STEPS_TO_PROVE_STOPPED * STEP_PAN);

    await expectPanStopped(card);
  });

  it('should not act on a key aimed at another card', async () => {
    const card = await mountCard();
    const otherCard = await mountCard({ keyMessage: OTHER_CARD_KEY_MESSAGE });

    // Either ledger reports both cards, since there is only one console. Which
    // card answered is in the message rather than in where it was read.
    await clickMedia(card);
    await pressKey('z');
    await card.console.waitForMessage(KEY_MESSAGE);

    await clickMedia(otherCard);
    await pressKey('z');
    await card.console.waitForMessage(OTHER_CARD_KEY_MESSAGE);

    // One press each. A dashboard of cards that all answer every key press
    // would run a shortcut once per card on screen.
    expect(card.console.countMessages(KEY_MESSAGE)).toBe(1);
    expect(card.console.countMessages(OTHER_CARD_KEY_MESSAGE)).toBe(1);
  });
});
