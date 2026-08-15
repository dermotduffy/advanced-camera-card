import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CallSession } from '../../../src/card-controller/call/types';
import type { MicrophoneManager } from '../../../src/card-controller/microphone-manager';
import { MicrophoneActionsController } from '../../../src/components-lib/live/microphone-actions-controller';
import {
  callIntersectionHandler,
  callVisibilityHandler,
  createParent,
  getMockIntersectionObserver,
  IntersectionObserverMock,
} from '../../test-utils';
import { createView } from '../../view/test-utils';

const createMicrophoneManager = (): MicrophoneManager => {
  const microphoneManager = mock<MicrophoneManager>();
  vi.mocked(microphoneManager.unmute).mockResolvedValue(undefined);
  return microphoneManager;
};

const createCallSession = (session?: Partial<CallSession>): CallSession => ({
  cameraID: 'camera-1',
  previousView: createView(),
  inbound: false,
  answered: true,
  ...session,
});

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

      expect(microphoneManager.mute).toHaveBeenCalledTimes(1);
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

      expect(microphoneManager.unmute).toHaveBeenCalledTimes(1);
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

      expect(microphoneManager.unmute).not.toHaveBeenCalled();
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

      expect(microphoneManager.mute).toHaveBeenCalledTimes(1);
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

      expect(microphoneManager.unmute).toHaveBeenCalledTimes(1);
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

      expect(microphoneManager.mute).not.toHaveBeenCalled();
      expect(microphoneManager.unmute).not.toHaveBeenCalled();
    });

    it('should swallow a rejected auto-unmute so a denied microphone does not surface', async () => {
      const microphoneManager = createMicrophoneManager();
      vi.mocked(microphoneManager.unmute).mockRejectedValue(new Error('denied'));
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['visible' as const],
      });
      controller.setRoot(createParent());

      await callIntersectionHandler(false);

      await expect(callIntersectionHandler(true)).resolves.toBeUndefined();
      expect(microphoneManager.unmute).toHaveBeenCalledTimes(1);
    });

    it('should not act when no condition is configured', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({ microphoneManager });
      controller.setRoot(createParent());

      await callIntersectionHandler(true);
      await callIntersectionHandler(false);
      await callIntersectionHandler(true);

      expect(microphoneManager.mute).not.toHaveBeenCalled();
      expect(microphoneManager.unmute).not.toHaveBeenCalled();
    });

    it('should not act when conditions are configured but no microphone manager is', async () => {
      // Guards the short-circuit on the helpers: with conditions configured but
      // no microphoneManager, .mute()/.unmute() must not be invoked on
      // undefined.
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        autoMuteConditions: ['hidden' as const],
        autoUnmuteConditions: ['visible' as const],
      });
      controller.setRoot(createParent());

      await callIntersectionHandler(true);

      await expect(callIntersectionHandler(false)).resolves.toBeUndefined();
      await expect(callIntersectionHandler(true)).resolves.toBeUndefined();
    });

    it('should not act before options are set', async () => {
      const controller = new MicrophoneActionsController();
      controller.setRoot(createParent());

      await callIntersectionHandler(true);

      await expect(callIntersectionHandler(false)).resolves.toBeUndefined();
      await expect(callIntersectionHandler(true)).resolves.toBeUndefined();
    });
  });

  describe('on call session change', () => {
    it('should unmute on call answer when call is a configured unmute condition', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['call' as const],
      });

      await controller.setCall(createCallSession({ inbound: true, answered: false }));
      await controller.setCall(createCallSession({ inbound: true }));

      expect(microphoneManager.unmute).toHaveBeenCalledTimes(1);
    });

    it('should unmute when the first call session is already answered', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['call' as const],
      });

      // Scenario: An outbound call started from the gallery, installs the
      // answered session and then navigates to live, so the live view's first
      // sight of the call is already answered.
      await controller.setCall(createCallSession());

      expect(microphoneManager.unmute).toHaveBeenCalledTimes(1);
    });

    it('should unmute again for a call that replaces an answered call', async () => {
      // A replacement call keeps the microphone connected, but the user may
      // have muted themselves during the call it replaced, so the new call
      // applies its own unmute rules rather than inheriting that mute.
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['call' as const],
      });

      await controller.setCall(createCallSession({ cameraID: 'camera-1' }));
      await controller.setCall(createCallSession({ cameraID: 'camera-2' }));

      expect(microphoneManager.unmute).toHaveBeenCalledTimes(2);
    });

    it('should not unmute again when the same call session is set again', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['call' as const],
      });
      const call = createCallSession();

      await controller.setCall(call);
      await controller.setCall(call);

      expect(microphoneManager.unmute).toHaveBeenCalledTimes(1);
    });

    it('should not mute on call end', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['call' as const],
      });

      await controller.setCall(createCallSession());
      await controller.setCall();

      // The microphone manager mutes and releases the microphone itself when
      // the call ends.
      expect(microphoneManager.mute).not.toHaveBeenCalled();
    });

    it('should not act on a ringing call', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: ['call' as const],
      });

      await controller.setCall(createCallSession({ inbound: true, answered: false }));

      expect(microphoneManager.mute).not.toHaveBeenCalled();
      expect(microphoneManager.unmute).not.toHaveBeenCalled();
    });

    it('should not act on call answer when call is not a configured condition', async () => {
      const microphoneManager = createMicrophoneManager();
      const controller = new MicrophoneActionsController();
      controller.setOptions({
        microphoneManager,
        autoUnmuteConditions: [],
      });

      await controller.setCall(createCallSession({ inbound: true, answered: false }));
      await controller.setCall(createCallSession({ inbound: true }));

      expect(microphoneManager.unmute).not.toHaveBeenCalled();
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
