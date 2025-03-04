import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MicrophoneState } from '../../src/card-controller/types';
import {
  MediaActionsController,
  MediaActionsControllerOptions,
} from '../../src/components-lib/media-actions-controller';
import { MediaPlayerController, MediaPlayerElement } from '../../src/types';
import {
  IntersectionObserverMock,
  MutationObserverMock,
  callIntersectionHandler,
  callMutationHandler,
  createParent,
  flushPromises,
} from '../test-utils';
import { callVisibilityHandler, createTestSlideNodes } from '../utils/embla/test-utils';

const getPlayer = (
  element: HTMLElement,
  selector: string,
): MediaPlayerElement | null => {
  return element.querySelector(selector);
};

const createPlayerElement = (controller?: MediaPlayerController): MediaPlayerElement => {
  const player = document.createElement('video');
  player['getMediaPlayerController'] = vi
    .fn()
    .mockResolvedValue(controller ?? mock<MediaPlayerController>());
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
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
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
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
      ).not.toBeCalled();
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

      const mediaPlayerController = mock<MediaPlayerController>();

      const newPlayer = createPlayerElement(mediaPlayerController);
      const newChild = document.createElement('div');
      newChild.appendChild(newPlayer);
      parent.append(newChild);

      await callMutationHandler();

      await controller.setTarget(1, true);

      expect(mediaPlayerController.play).toBeCalled();
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
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
      ).not.toBeCalled();
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
          (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.[func],
        ).toBeCalledTimes(called ? 1 : 0);
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
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
      ).toBeCalledTimes(1);

      await controller.setTarget(0, true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
      ).toBeCalledTimes(1);
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
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.pause,
      ).toBeCalled();
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.mute,
      ).toBeCalled();
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
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
      ).not.toBeCalled();
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).not.toBeCalled();

      await controller.setTarget(0, true);

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
      ).toBeCalled();
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toBeCalled();
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
      (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
    ).toBeCalledTimes(1);
    expect(
      (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
    ).toBeCalledTimes(1);

    controller.unsetTarget();

    getPlayer(children[0], 'video')?.dispatchEvent(
      new Event('advanced-camera-card:media:loaded'),
    );
    await flushPromises();

    // Play/Mute will not have been called again.
    expect(
      (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
    ).toBeCalledTimes(1);
    expect(
      (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
    ).toBeCalledTimes(1);
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
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
      ).toBeCalledTimes(1);

      getPlayer(children[0], 'video')?.dispatchEvent(
        new Event('advanced-camera-card:media:loaded'),
      );

      await flushPromises();

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
      ).toBeCalledTimes(2);
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
      ).toBeCalledTimes(1);

      getPlayer(children[0], 'video')?.dispatchEvent(
        new Event('advanced-camera-card:media:loaded'),
      );

      await flushPromises();

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toBeCalledTimes(2);
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
        (await getPlayer(children[9], 'video')?.getMediaPlayerController())?.play,
      ).not.toBeCalled();
      expect(
        (await getPlayer(children[9], 'video')?.getMediaPlayerController())?.unmute,
      ).not.toBeCalled();
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
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
      ).toBeCalledTimes(1);
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toBeCalledTimes(1);

      getPlayer(children[0], 'video')?.dispatchEvent(
        new Event('advanced-camera-card:media:loaded'),
      );

      await flushPromises();

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.play,
      ).toBeCalledTimes(2);
      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toBeCalledTimes(2);
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
          (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.[func],
        ).toBeCalledTimes(called ? 1 : 0);
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

        // Not configured to take action on selection.
        expect(
          (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.[func],
        ).not.toBeCalled();

        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          writable: true,
        });
        await callVisibilityHandler();

        // Not configured to take action on selection.
        expect(
          (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.[func],
        ).toBeCalledTimes(called ? 1 : 0);
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

        // Not configured to take action on selection.
        expect(
          (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.[func],
        ).not.toBeCalled();

        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          writable: true,
        });
        await callVisibilityHandler();

        // Not configured to take action on selection.
        expect(
          (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.[func],
        ).toBeCalledTimes(called ? 1 : 0);
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
          (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.[func],
        ).not.toBeCalled();

        // There's always a first call to an intersection observer handler. In
        // this case the MediaActionsController ignores it.
        await callIntersectionHandler(false);

        await callIntersectionHandler(true);

        // Not configured to take action on selection.
        expect(
          (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.[func],
        ).toBeCalledTimes(called ? 1 : 0);
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
          (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.[func],
        ).not.toBeCalled();

        // There's always a first call to an intersection observer handler. In
        // this case the MediaActionsController ignores it.
        await callIntersectionHandler(false);

        await callIntersectionHandler(true);

        // Not configured to take action on selection.
        expect(
          (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.[func],
        ).toBeCalledTimes(called ? 1 : 0);
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
        microphoneState: createMicrophoneState({ muted: true }),
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);

      controller.setOptions({
        autoUnmuteConditions: ['microphone' as const],
        playerSelector: 'video',
        microphoneState: createMicrophoneState({ muted: false }),
      });

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.unmute,
      ).toBeCalled();
    });

    it('should mute after delay after microphone muted', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoMuteConditions: ['microphone' as const],
        playerSelector: 'video',
        microphoneState: createMicrophoneState({ muted: false }),
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);

      controller.setOptions({
        autoMuteConditions: ['microphone' as const],
        playerSelector: 'video',
        microphoneState: createMicrophoneState({ muted: true }),
      });

      vi.runOnlyPendingTimers();

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.mute,
      ).toBeCalled();
    });

    it('should not mute after delay after microphone muted', async () => {
      const controller = new MediaActionsController();

      controller.setOptions({
        autoMuteConditions: [],
        playerSelector: 'video',
        microphoneState: createMicrophoneState({ muted: false }),
      });

      const children = createPlayerSlideNodes();
      controller.setRoot(createParent({ children: children }));

      await controller.setTarget(0, true);

      controller.setOptions({
        autoMuteConditions: ['microphone' as const],
        playerSelector: 'video',
        microphoneState: createMicrophoneState({ muted: true }),
      });

      vi.runOnlyPendingTimers();

      expect(
        (await getPlayer(children[0], 'video')?.getMediaPlayerController())?.mute,
      ).not.toBeCalled();
    });
  });
});
