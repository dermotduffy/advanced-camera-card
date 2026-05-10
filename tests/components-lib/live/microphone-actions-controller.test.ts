import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MicrophoneManager } from '../../../src/card-controller/microphone-manager';
import { MicrophoneActionsController } from '../../../src/components-lib/live/microphone-actions-controller';
import {
  IntersectionObserverMock,
  callIntersectionHandler,
  callVisibilityHandler,
  createParent,
  getMockIntersectionObserver,
} from '../../test-utils';

const createMicrophoneManager = (): MicrophoneManager => {
  const microphoneManager = mock<MicrophoneManager>();
  vi.mocked(microphoneManager.unmute).mockResolvedValue(undefined);
  return microphoneManager;
};

// @vitest-environment jsdom
describe('MicrophoneActionsController', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    // callVisibilityHandler reads from this spy.
    vi.spyOn(global.document, 'addEventListener');
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document.visibilityState so each test starts with the tab
    // visible and is not affected by leftover state from a prior
    // `callVisibilityHandler(false)`.
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  describe('on selected camera change', () => {
    it('should unmute on selected when a camera becomes selected', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['selected' as const],
      });

      await controller.setSelectedCamera('camera-1');

      expect(microphoneManager.unmute).toBeCalledTimes(1);
      expect(microphoneManager.mute).not.toBeCalled();
    });

    it('should mute on unselected when transitioning to a new camera', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoMuteConditions: ['unselected' as const],
      });

      await controller.setSelectedCamera('camera-1');
      await controller.setSelectedCamera('camera-2');

      expect(microphoneManager.mute).toBeCalledTimes(1);
    });

    it('should sequence mute-then-unmute deterministically on transition', async () => {
      // Why this ordering matters: in grid mode, each camera cell owns its own
      // MediaActionsController, but every cell shares the global
      // MicrophoneManager. Without a single coordinator, a B->A selection
      // change would have cell B fire 'unselected' (mute) and cell A fire
      // 'selected' (unmute) independently, with order decided by Lit's sibling
      // update sequence -- leaving the final mic state nondeterministic, and
      // sometimes ending up muted despite `auto_unmute: ['selected']` being
      // configured. This controller is that single coordinator: it always emits
      // unselected then selected so the arriver wins.
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      const callOrder: string[] = [];
      vi.mocked(microphoneManager.mute).mockImplementation(() => {
        callOrder.push('mute');
      });
      vi.mocked(microphoneManager.unmute).mockImplementation(async () => {
        callOrder.push('unmute');
      });
      controller.setOptions({
        microphoneManager,
        autoMuteConditions: ['unselected' as const],
        autoUnmuteConditions: ['selected' as const],
      });

      await controller.setSelectedCamera('camera-A');
      callOrder.length = 0;

      await controller.setSelectedCamera('camera-B');

      expect(callOrder).toEqual(['mute', 'unmute']);
    });

    it('should not refire when the same camera is set again', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['selected' as const],
      });

      await controller.setSelectedCamera('camera-1');
      await controller.setSelectedCamera('camera-1');

      expect(microphoneManager.unmute).toBeCalledTimes(1);
    });

    it('should fire unselected only when transitioning from a camera to none', async () => {
      // camera=null path: previous exists, new is null. Only mute fires.
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoMuteConditions: ['unselected' as const],
        autoUnmuteConditions: ['selected' as const],
      });

      await controller.setSelectedCamera('camera-1');
      vi.mocked(microphoneManager.unmute).mockClear();
      vi.mocked(microphoneManager.mute).mockClear();

      await controller.setSelectedCamera(null);

      expect(microphoneManager.mute).toBeCalledTimes(1);
      expect(microphoneManager.unmute).not.toBeCalled();
    });

    it('should not fire unselected on the very first selection (no previous)', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoMuteConditions: ['unselected' as const],
        autoUnmuteConditions: ['selected' as const],
      });

      await controller.setSelectedCamera('camera-1');

      expect(microphoneManager.mute).not.toBeCalled();
      expect(microphoneManager.unmute).toBeCalledTimes(1);
    });

    it('should not fire when condition arrays are empty', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoMuteConditions: [],
        autoUnmuteConditions: [],
      });

      await controller.setSelectedCamera('camera-1');
      await controller.setSelectedCamera('camera-2');

      expect(microphoneManager.mute).not.toBeCalled();
      expect(microphoneManager.unmute).not.toBeCalled();
    });

    it('should not crash when conditions configured but no microphone manager is passed', async () => {
      // Guards the short-circuit on the helpers: with conditions configured
      // but no microphoneManager, .mute()/.unmute() must not be invoked on
      // undefined.
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        autoMuteConditions: ['unselected' as const],
        autoUnmuteConditions: ['selected' as const],
      });

      await expect(controller.setSelectedCamera('camera-1')).resolves.toBeUndefined();
      await expect(controller.setSelectedCamera('camera-2')).resolves.toBeUndefined();
    });
  });

  describe('on document visibility change', () => {
    it('should mute on hidden when the live root is intersecting', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoMuteConditions: ['hidden' as const],
      });
      controller.setRoot(createParent());

      // baseline: visible=true
      await callIntersectionHandler(true);

      await callVisibilityHandler(false);

      expect(microphoneManager.mute).toBeCalledTimes(1);
    });

    it('should unmute on visible when the live root is intersecting', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['visible' as const],
      });
      controller.setRoot(createParent());

      // baseline: visible=true
      await callIntersectionHandler(true);

      // visible -> hidden
      await callVisibilityHandler(false);
      vi.mocked(microphoneManager.unmute).mockClear();

      await callVisibilityHandler(true);

      expect(microphoneManager.unmute).toBeCalledTimes(1);
    });

    it('should not unmute on tab visible when the live root is hidden', async () => {
      // With live.preload, the live element stays in DOM but is hidden via
      // display:none in non-live views. The intersection observer reports false
      // for that, so VisibilityObserver suppresses the unmute even when the tab
      // regains focus. Without this gate, tab focus would prompt for / open the
      // microphone from a hidden live view.
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['visible' as const],
      });
      controller.setRoot(createParent());
      await callIntersectionHandler(false); // baseline: element not visible

      await callVisibilityHandler(false);
      await callVisibilityHandler(true);

      expect(microphoneManager.unmute).not.toBeCalled();
    });
  });

  describe('on intersection change', () => {
    it('should mute when the live root scrolls out of view', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoMuteConditions: ['hidden' as const],
      });
      controller.setRoot(createParent());

      // First intersection callback establishes baseline; only true transitions
      // thereafter trigger actions.
      await callIntersectionHandler(true);
      await callIntersectionHandler(false);

      expect(microphoneManager.mute).toBeCalledTimes(1);
    });

    it('should unmute when the live root scrolls back into view', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['visible' as const],
      });
      controller.setRoot(createParent());

      await callIntersectionHandler(false);
      await callIntersectionHandler(true);

      expect(microphoneManager.unmute).toBeCalledTimes(1);
    });

    it('should ignore the very first intersection callback (baseline)', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoMuteConditions: ['hidden' as const],
        autoUnmuteConditions: ['visible' as const],
      });
      controller.setRoot(createParent());

      await callIntersectionHandler(false);

      expect(microphoneManager.mute).not.toBeCalled();
      expect(microphoneManager.unmute).not.toBeCalled();
    });
  });

  describe('lifecycle', () => {
    it('should be idempotent on setRoot for the same element', () => {
      const controller = new MicrophoneActionsController();
      const parent = createParent();

      controller.setRoot(parent);
      const intersectionObserver = getMockIntersectionObserver();
      expect(intersectionObserver?.observe).toHaveBeenCalledTimes(1);
      expect(intersectionObserver?.disconnect).toHaveBeenCalledTimes(1);

      controller.setRoot(parent);

      // Same root: no re-observe, no re-disconnect.
      expect(intersectionObserver?.observe).toHaveBeenCalledTimes(1);
      expect(intersectionObserver?.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should disconnect the intersection observer and remove the visibility listener on destroy', () => {
      const removeEventListenerSpy = vi.spyOn(global.document, 'removeEventListener');
      const controller = new MicrophoneActionsController();
      controller.setRoot(createParent());

      const intersectionObserver = getMockIntersectionObserver();

      controller.destroy();

      expect(intersectionObserver?.disconnect).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
    });
  });
});
