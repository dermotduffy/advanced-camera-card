import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { MicrophoneState } from '../../src/card-controller/types';
import {
  MediaActionsController,
  type MediaActionsControllerOptions,
} from '../../src/components-lib/media-actions-controller';
import type {
  MediaPlayerController,
  MediaPlayerElement,
  PlaybackControl,
} from '../../src/types';
import {
  callIntersectionHandler,
  callMutationHandler,
  callVisibilityHandler,
  createParent,
  flushPromises,
  IntersectionObserverMock,
  MutationObserverMock,
} from '../test-utils';
import { createTestSlideNodes } from '../utils/embla/test-utils';

const getPlayer = (
  element: HTMLElement,
  selector: string,
): MediaPlayerElement | null => {
  return element.querySelector(selector);
};

// play/pause live on the optional `playback` capability; mute/unmute on the
// controller itself.
const getActionSpy = (
  controller: MediaPlayerController | null | undefined,
  func: string,
): unknown => {
  if (func === 'play' || func === 'pause') {
    return controller?.playback?.[func];
  }
  return func === 'mute' ? controller?.mute : controller?.unmute;
};

const createPlayerElement = (controller?: MediaPlayerController): MediaPlayerElement => {
  const player = document.createElement('video');
  player['getMediaPlayerController'] = vi
    .fn()
    .mockResolvedValue(
      controller ?? mock<MediaPlayerController>({ playback: mock<PlaybackControl>() }),
    );
  return player as unknown as MediaPlayerElement;
};

const createPlayerSlideNodes = (n = 10): HTMLElement[] => {
  const divs = createTestSlideNodes({ n: n });
  for (const div of divs) {
    div.appendChild(createPlayerElement());
  }
  return divs;
};

// @vitest-environment jsdom
describe('MediaActionsController', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    vi.stubGlobal('MutationObserver', MutationObserverMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset document.visibilityState so each test starts with the tab visible
    // and is not affected by leftover state from a prior
    // `callVisibilityHandler(false)`.
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  describe('should set root', () => {
    it('should have root', async () => {
      const controller = new MediaActionsController();

      controller.setRoot(createParent());

      expect(controller.hasRoot()).toBeTruthy();
    });

    it('should do nothing without options', async () => {
      const controller = new MediaActionsController();

      const children = createPlayerSlideNodes();
      const parent = createParent({ children: children });

      controller.setRoot(parent);
      await controller.setTarget(0, true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
          ?.play,
      ).not.toHaveBeenCalled();
    });

    it('should do nothing on resetting same root', () => {
      const controller = new MediaActionsController();
      const parent = createParent({ children: createPlayerSlideNodes() });

      expect(controller.setRoot(parent)).toBeTruthy();
      expect(controller.setRoot(parent)).toBeFalsy();
    });

    it('should re-setRoot after mutation', async () => {
      const controller = new MediaActionsController();
      controller.setOptions({
        playerSelector: 'video',
        autoPlayConditions: ['selected' as const],
      });

      const parent = createParent({ children: createPlayerSlideNodes(1) });
      controller.setRoot(parent);

      const mediaPlayerController = mock<MediaPlayerController>({
        playback: mock<PlaybackControl>(),
      });

      const newPlayer = createPlayerElement(mediaPlayerController);
      const newChild = document.createElement('div');
      newChild.appendChild(newPlayer);
      parent.append(newChild);

      await callMutationHandler();

      await controller.setTarget(1, true);

      expect(mediaPlayerController.playback?.play).toHaveBeenCalled();
    });
  });

  describe('should destroy', () => {
    it('should do nothing after destroy', async () => {
      const controller = new MediaActionsController();
      controller.setOptions({
        playerSelector: 'video',
        autoPlayConditions: ['selected' as const],
      });

      const children = createPlayerSlideNodes();
      const parent = createParent({ children: children });
      controller.setRoot(parent);

      controller.destroy();

      await controller.setTarget(0, true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
          ?.play,
      ).not.toHaveBeenCalled();
    });
  });

  describe('should respond to setting target', () => {
    it.each([
      ['should play', { autoPlayConditions: ['selected' as const] }, 'play', true],
      ['should not play', { autoPlayConditions: [] }, 'play', false],
      ['should unmute', { autoUnmuteConditions: ['selected' as const] }, 'unmute', true],
      ['should not unmute', { autoUnmuteConditions: [] }, 'unmute', false],
    ])(
      '%s',
      async (
        _: string,
        options: Partial<MediaActionsControllerOptions>,
        func: string,
        called: boolean,
      ) => {
        const controller = new MediaActionsController();
        controller.setOptions({
          playerSelector: 'video',
          ...options,
        });

        const children = createPlayerSlideNodes();
        controller.setRoot(createParent({ children: children }));

        await controller.setTarget(0, true);

        expect(
          getActionSpy(
            await getPlayer(children[0], 'video')?.getMediaPlayerController(),
            func,
          ),
        ).toHaveBeenCalledTimes(called ? 1 : 0);
      },
    );

    it('should not reselect previously selected target', async () => {
      const controller = new MediaActionsController();
      controller.setOptions({
        autoPlayConditions: ['selected' as const],
        playerSelector: 'video',
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
          ?.play,
      ).toHaveBeenCalledTimes(1);

      await controller.setTarget(0, true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
          ?.play,
      ).toHaveBeenCalledTimes(1);
    });

    it('should unselect before selecting a new target', async () => {
      const controller = new MediaActionsController();
      controller.setOptions({
        autoPauseConditions: ['unselected' as const],
        autoMuteConditions: ['unselected' as const],
        playerSelector: 'video',
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);
      await controller.setTarget(1, true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
          ?.pause,
      ).toHaveBeenCalled();
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.mute,
      ).toHaveBeenCalled();
    });

    it('should select after target was previously visible', async () => {
      const controller = new MediaActionsController();
      controller.setOptions({
        autoPlayConditions: ['selected' as const],
        autoUnmuteConditions: ['selected' as const],
        playerSelector: 'video',
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, false);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
          ?.play,
      ).not.toHaveBeenCalled();
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).not.toHaveBeenCalled();

      await controller.setTarget(0, true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
          ?.play,
      ).toHaveBeenCalled();
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toHaveBeenCalled();
    });
  });

  it('should take no action after target unset', async () => {
    const controller = new MediaActionsController();
    controller.setOptions({
      autoPlayConditions: ['selected' as const, 'visible' as const],
      autoUnmuteConditions: ['selected' as const, 'visible' as const],
      playerSelector: 'video',
    });

    const children = createPlayerSlideNodes();
    controller.setRoot(createParent({ children: children }));

    await controller.setTarget(0, true);

    expect(
      (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
        ?.play,
    ).toHaveBeenCalledTimes(1);
    expect(
      (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
    ).toHaveBeenCalledTimes(1);

    controller.unsetTarget();

    getPlayer(children[0], 'video')?.dispatchEvent(
      new Event('advanced-camera-card:media:loaded'),
    );
    await flushPromises();

    // Play/Mute will not have been called again.
    expect(
      (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
        ?.play,
    ).toHaveBeenCalledTimes(1);
    expect(
      (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
    ).toHaveBeenCalledTimes(1);
  });

  describe('should respond to media loaded', () => {
    it('should play after media load', async () => {
      const controller = new MediaActionsController();
      controller.setOptions({
        autoPlayConditions: ['selected' as const],
        playerSelector: 'video',
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
          ?.play,
      ).toHaveBeenCalledTimes(1);

      getPlayer(children[0], 'video')?.dispatchEvent(
        new Event('advanced-camera-card:media:loaded'),
      );

      await flushPromises();

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
          ?.play,
      ).toHaveBeenCalledTimes(2);
    });

    it('should unmute after media load', async () => {
      const controller = new MediaActionsController();
      controller.setOptions({
        autoUnmuteConditions: ['selected' as const],
        playerSelector: 'video',
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toHaveBeenCalledTimes(1);

      getPlayer(children[0], 'video')?.dispatchEvent(
        new Event('advanced-camera-card:media:loaded'),
      );

      await flushPromises();

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toHaveBeenCalledTimes(2);
    });

    it('should take no action on unrelated media load', async () => {
      const controller = new MediaActionsController();
      controller.setOptions({
        autoPlayConditions: ['selected' as const, 'visible' as const],
        autoUnmuteConditions: ['selected' as const, 'visible' as const],
        playerSelector: 'video',
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);

      getPlayer(children[9], 'video')?.dispatchEvent(
        new Event('advanced-camera-card:media:loaded'),
      );

      await flushPromises();

      expect(
        (await getPlayer(children[9], 'video')?.getMediaPlayerController())?.playback
          ?.play,
      ).not.toHaveBeenCalled();
      expect(
        (await getPlayer(children[9], 'video')?.getMediaPlayerController())?.unmute,
      ).not.toHaveBeenCalled();
    });

    it('should play and unmute on unselected but targeted media load', async () => {
      const controller = new MediaActionsController();
      controller.setOptions({
        autoPlayConditions: ['visible' as const],
        autoUnmuteConditions: ['visible' as const],
        playerSelector: 'video',
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, false);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
          ?.play,
      ).toHaveBeenCalledTimes(1);
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toHaveBeenCalledTimes(1);

      getPlayer(children[0], 'video')?.dispatchEvent(
        new Event('advanced-camera-card:media:loaded'),
      );

      await flushPromises();

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.playback
          ?.play,
      ).toHaveBeenCalledTimes(2);
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe('should take action on unselect', () => {
    it.each([
      ['should pause', { autoPauseConditions: ['unselected' as const] }, 'pause', true],
      ['should not pause', { autoPauseConditions: [] }, 'pause', false],
      ['should mute', { autoMuteConditions: ['unselected' as const] }, 'mute', true],
      ['should not mute', { autoMuteConditions: [] }, 'mute', false],
    ])(
      '%s',
      async (
        _: string,
        options: Partial<MediaActionsControllerOptions>,
        func: string,
        called: boolean,
      ) => {
        const controller = new MediaActionsController();
        controller.setOptions({
          playerSelector: 'video',
          ...options,
        });

        const children = createPlayerSlideNodes();
        controller.setRoot(createParent({ children: children }));

        await controller.setTarget(0, true);
        await controller.setTarget(0, false);

        expect(
          getActionSpy(
            await getPlayer(children[0], 'video')?.getMediaPlayerController(),
            func,
          ),
        ).toHaveBeenCalledTimes(called ? 1 : 0);
      },
    );
  });

  describe('should take action on page being visible', () => {
    it.each([
      ['should play', { autoPlayConditions: ['visible' as const] }, 'play', true],
      ['should not play', { autoPlayConditions: [] }, 'play', false],
      ['should unmute', { autoUnmuteConditions: ['visible' as const] }, 'unmute', true],
      ['should not unmute', { autoUnmuteConditions: [] }, 'unmute', false],
    ])(
      '%s',
      async (
        _: string,
        options: Partial<MediaActionsControllerOptions>,
        func: string,
        called: boolean,
      ) => {
        vi.spyOn(global.document, 'addEventListener');

        const controller = new MediaActionsController();
        controller.setOptions({
          playerSelector: 'video',
          ...options,
        });

        const children = createPlayerSlideNodes();
        controller.setRoot(createParent({ children: children }));
        await controller.setTarget(0, true);

        // The 'visible' rule fires when the element is both intersecting and
        // the tab is visible. Set up element-intersecting + tab-hidden first so
        // that the next callVisibilityHandler(true) is a real hidden->visible
        // transition. The hidden transition itself only fires pause/mute (not
        // play/unmute), so it does not affect the call count of `func` here.
        await callIntersectionHandler(true);
        await callVisibilityHandler(false);

        await callVisibilityHandler(true);

        expect(
          getActionSpy(
            await getPlayer(children[0], 'video')?.getMediaPlayerController(),
            func,
          ),
        ).toHaveBeenCalledTimes(called ? 1 : 0);
      },
    );
  });

  describe('should take action on page being hiddne', () => {
    beforeAll(() => {
      vi.spyOn(global.document, 'addEventListener');
    });

    it.each([
      ['should pause', { autoPauseConditions: ['hidden' as const] }, 'pause', true],
      ['should not pause', { autoPauseConditions: [] }, 'pause', false],
      ['should mute', { autoMuteConditions: ['hidden' as const] }, 'mute', true],
      ['should not mute', { autoMuteConditions: [] }, 'mute', false],
    ])(
      '%s',
      async (
        _: string,
        options: Partial<MediaActionsControllerOptions>,
        func: string,
        called: boolean,
      ) => {
        const controller = new MediaActionsController();
        controller.setOptions({
          playerSelector: 'video',
          ...options,
        });

        const children = createPlayerSlideNodes();
        controller.setRoot(createParent({ children: children }));
        await controller.setTarget(0, true);

        // The 'hidden' rule fires on a transition from visible to hidden.
        // Establish element-intersecting + tab-visible first so that
        // callVisibilityHandler(false) is a real visible->hidden transition.
        await callIntersectionHandler(true);

        await callVisibilityHandler(false);

        expect(
          getActionSpy(
            await getPlayer(children[0], 'video')?.getMediaPlayerController(),
            func,
          ),
        ).toHaveBeenCalledTimes(called ? 1 : 0);
      },
    );
  });

  describe('should take action on page intersecting with viewport', () => {
    it.each([
      ['should play', { autoPlayConditions: ['visible' as const] }, 'play', true],
      ['should not play', { autoPlayConditions: [] }, 'play', false],
      ['should unmute', { autoUnmuteConditions: ['visible' as const] }, 'unmute', true],
      ['should not unmute', { autoUnmuteConditions: [] }, 'unmute', false],
    ])(
      '%s',
      async (
        _: string,
        options: Partial<MediaActionsControllerOptions>,
        func: string,
        called: boolean,
      ) => {
        const controller = new MediaActionsController();
        controller.setOptions({
          playerSelector: 'video',
          ...options,
        });

        const children = createPlayerSlideNodes();
        controller.setRoot(createParent({ children: children }));
        await controller.setTarget(0, true);

        // Not configured to take action on selection.
        expect(
          getActionSpy(
            await getPlayer(children[0], 'video')?.getMediaPlayerController(),
            func,
          ),
        ).not.toHaveBeenCalled();

        // There's always a first call to an intersection observer handler. In
        // this case the MediaActionsController ignores it.
        await callIntersectionHandler(false);

        await callIntersectionHandler(true);

        // Not configured to take action on selection.
        expect(
          getActionSpy(
            await getPlayer(children[0], 'video')?.getMediaPlayerController(),
            func,
          ),
        ).toHaveBeenCalledTimes(called ? 1 : 0);
      },
    );
  });

  describe('should take action on page not intersecting with viewport', () => {
    it.each([
      ['should play', { autoPlayConditions: ['visible' as const] }, 'play', true],
      ['should not play', { autoPlayConditions: [] }, 'play', false],
      ['should unmute', { autoUnmuteConditions: ['visible' as const] }, 'unmute', true],
      ['should not unmute', { autoUnmuteConditions: [] }, 'unmute', false],
    ])(
      '%s',
      async (
        _: string,
        options: Partial<MediaActionsControllerOptions>,
        func: string,
        called: boolean,
      ) => {
        const controller = new MediaActionsController();
        controller.setOptions({
          playerSelector: 'video',
          ...options,
        });

        const children = createPlayerSlideNodes();
        controller.setRoot(createParent({ children: children }));
        await controller.setTarget(0, true);

        // Not configured to take action on selection.
        expect(
          getActionSpy(
            await getPlayer(children[0], 'video')?.getMediaPlayerController(),
            func,
          ),
        ).not.toHaveBeenCalled();

        // There's always a first call to an intersection observer handler. In
        // this case the MediaActionsController ignores it.
        await callIntersectionHandler(false);

        await callIntersectionHandler(true);

        // Not configured to take action on selection.
        expect(
          getActionSpy(
            await getPlayer(children[0], 'video')?.getMediaPlayerController(),
            func,
          ),
        ).toHaveBeenCalledTimes(called ? 1 : 0);
      },
    );
  });

  describe('should take action on microphone state changes', () => {
    beforeAll(() => {
      vi.useFakeTimers();
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    const createMicrophoneState = (
      state?: Partial<MicrophoneState>,
    ): MicrophoneState => {
      return {
        muted: true,
        forbidden: false,
        connected: false,
        ...state,
      };
    };

    it('should unmute when microphone unmuted', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoUnmuteConditions: ['microphone' as const],
        playerSelector: 'video',
      });
      controller.setMicrophoneState(createMicrophoneState({ muted: true }));

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);

      controller.setMicrophoneState(createMicrophoneState({ muted: false }));

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toHaveBeenCalled();
    });

    it('should mute after delay after microphone muted', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoMuteConditions: ['microphone' as const],
        playerSelector: 'video',
      });
      controller.setMicrophoneState(createMicrophoneState({ muted: false }));

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);

      controller.setMicrophoneState(createMicrophoneState({ muted: true }));

      vi.runOnlyPendingTimers();

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.mute,
      ).toHaveBeenCalled();
    });

    it('should not mute after delay after microphone muted', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoMuteConditions: [],
        playerSelector: 'video',
      });
      controller.setMicrophoneState(createMicrophoneState({ muted: false }));

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);

      controller.setMicrophoneState(createMicrophoneState({ muted: true }));

      vi.runOnlyPendingTimers();

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.mute,
      ).not.toHaveBeenCalled();
    });

    it('should not act on the initial microphone state', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoUnmuteConditions: ['microphone' as const],
        playerSelector: 'video',
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));
      await controller.setTarget(0, true);

      controller.setMicrophoneState(createMicrophoneState({ muted: false }));

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).not.toHaveBeenCalled();
    });
  });

  describe('should take action on call answered state changes', () => {
    it('should unmute the target on call answer', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoUnmuteConditions: ['call' as const],
        playerSelector: 'video',
      });
      controller.setCallAnswered(false);

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);

      controller.setCallAnswered(true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toHaveBeenCalled();
    });

    it('should mute the target on call end', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoMuteConditions: ['call' as const],
        playerSelector: 'video',
      });
      controller.setCallAnswered(true);

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);

      controller.setCallAnswered(false);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.mute,
      ).toHaveBeenCalled();
    });

    it('should not act on the initial call state', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoMuteConditions: ['call' as const],
        autoUnmuteConditions: ['call' as const],
        playerSelector: 'video',
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));
      await controller.setTarget(0, true);

      controller.setCallAnswered(false);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.mute,
      ).not.toHaveBeenCalled();
    });

    it('should not act when call is not a configured condition', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoUnmuteConditions: [],
        playerSelector: 'video',
      });
      controller.setCallAnswered(false);

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));
      await controller.setTarget(0, true);

      controller.setCallAnswered(true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).not.toHaveBeenCalled();
    });

    it('should apply the call-answer unmute when the target arrives after the call', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoUnmuteConditions: ['call' as const],
        playerSelector: 'video',
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      // The call is answered before any target is selected: with no target,
      // the unmute cannot be applied yet.
      controller.setCallAnswered(true);
      await flushPromises();
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).not.toHaveBeenCalled();

      await controller.setTarget(0, true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toHaveBeenCalled();
    });

    it('should unmute when the call is already answered on the first call-state signal', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoUnmuteConditions: ['call' as const],
        playerSelector: 'video',
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));
      await controller.setTarget(0, true);

      // `setCallAnswered(true)` is the first call-state signal, with no
      // preceding `false` -- as for a carousel that loads while an answered
      // call is already active. The initial state must not be swallowed as
      // a baseline.
      controller.setCallAnswered(true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toHaveBeenCalled();
    });

    it('should defer the call-answer unmute until the media player is ready', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoUnmuteConditions: ['call' as const],
        playerSelector: 'video',
      });
      controller.setCallAnswered(false);

      // A player whose media player controller is not ready on first request.
      const mediaPlayerController = mock<MediaPlayerController>();
      const player = document.createElement('video');
      player['getMediaPlayerController'] = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue(mediaPlayerController);
      const child = createTestSlideNodes({ n: 1 })[0];
      child.appendChild(player as unknown as MediaPlayerElement);

      controller.setRoot(createParent({ children: [child] }));
      await controller.setTarget(0, true);

      // The call is answered while the player is still not ready: no unmute yet.
      controller.setCallAnswered(true);
      await flushPromises();
      expect(mediaPlayerController.unmute).not.toHaveBeenCalled();

      // Once the media loads the deferred unmute is applied -- exactly once,
      // so a later reload cannot clobber a manual mute made during the call.
      player.dispatchEvent(new Event('advanced-camera-card:media:loaded'));
      await flushPromises();
      player.dispatchEvent(new Event('advanced-camera-card:media:loaded'));
      await flushPromises();
      expect(mediaPlayerController.unmute).toHaveBeenCalledTimes(1);
    });
  });
});
