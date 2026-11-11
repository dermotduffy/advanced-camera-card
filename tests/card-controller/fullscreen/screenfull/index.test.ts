import screenfull from 'screenfull';
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScreenfullFullScreenProvider } from '../../../../src/card-controller/fullscreen/screenfull';
import {
  createCardAPI,
  createDocumentVisibility,
  flushPromises,
  setScreenfulEnabled,
} from '../../../test-utils';
import { createPromiseWithResolvers } from '../../../utils/test-utils';

vi.mock('screenfull', () => ({
  default: {
    exit: vi.fn(),
    request: vi.fn(),
    off: vi.fn(),
    on: vi.fn(),
  },
}));

const setScreenfulFullscreen = (fullscreen: boolean): void => {
  Object.defineProperty(screenfull, 'isFullscreen', {
    value: fullscreen,
    writable: true,
  });
};

// @vitest-environment jsdom
describe('ScreenfullFullScreenProvider', () => {
  beforeEach(() => {
    vi.mocked(screenfull.request).mockResolvedValue();
    vi.mocked(screenfull.exit).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('should connect', () => {
    it('should connect if enabled', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());
      const on = vi.mocked(screenfull.on);

      setScreenfulEnabled(true);

      provider.connect();

      expect(on).toHaveBeenCalledWith('change', expect.anything());
    });

    it('should not connect if not enabled', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());
      const on = vi.mocked(screenfull.on);

      setScreenfulEnabled(false);

      provider.connect();

      expect(on).not.toHaveBeenCalled();
    });
  });

  describe('should disconnect', () => {
    it('should disconnect if enabled', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());
      const off = vi.mocked(screenfull.off);

      setScreenfulEnabled(true);

      provider.disconnect();

      expect(off).toHaveBeenCalledWith('change', expect.anything());
    });

    it('should not disconnect if not enabled', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());
      const off = vi.mocked(screenfull.off);

      setScreenfulEnabled(false);

      provider.disconnect();

      expect(off).not.toHaveBeenCalled();
    });
  });

  describe('should return if in fullscreen', () => {
    it('should return true if in fullscreen', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());

      setScreenfulEnabled(true);
      setScreenfulFullscreen(true);

      expect(provider.isInFullscreen()).toBeTruthy();
    });

    it('should return false if not in fullscreen', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());

      setScreenfulEnabled(true);
      setScreenfulFullscreen(false);

      expect(provider.isInFullscreen()).toBeFalsy();
    });

    it('should return false if not supported', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());

      setScreenfulEnabled(false);
      setScreenfulFullscreen(true);

      expect(provider.isInFullscreen()).toBeFalsy();
    });
  });

  describe('should return if supported', () => {
    it('should return true if supported', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());

      setScreenfulEnabled(true);

      expect(provider.isSupported()).toBeTruthy();
    });

    it('should return false if not supported', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());

      setScreenfulEnabled(false);

      expect(provider.isSupported()).toBeFalsy();
    });
  });

  describe('should set fullscreen', () => {
    it('should request fullscreen if fullscreen is true', () => {
      setScreenfulEnabled(true);

      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const provider = new ScreenfullFullScreenProvider(api, vi.fn());

      provider.setFullscreen(true);

      expect(screenfull.request).toHaveBeenCalledWith(element);
    });

    it('should exit fullscreen if fullscreen is false', () => {
      setScreenfulEnabled(true);

      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());

      provider.setFullscreen(false);

      expect(screenfull.exit).toHaveBeenCalled();
    });

    it('should take no action if not supported', () => {
      setScreenfulEnabled(false);

      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const provider = new ScreenfullFullScreenProvider(api, vi.fn());

      provider.setFullscreen(true);
      provider.setFullscreen(false);

      expect(screenfull.request).not.toHaveBeenCalled();
      expect(screenfull.exit).not.toHaveBeenCalled();
    });

    it('should swallow a rejected fullscreen request', async () => {
      setScreenfulEnabled(true);
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(screenfull.request).mockRejectedValue(new Error('denied'));
      const provider = new ScreenfullFullScreenProvider(api, vi.fn());

      provider.setFullscreen(true);
      await flushPromises();

      expect(screenfull.request).toHaveBeenCalledWith(element);
    });

    it('should swallow a rejected fullscreen exit', async () => {
      setScreenfulEnabled(true);
      vi.mocked(screenfull.exit).mockRejectedValue(new Error('not in fullscreen'));
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());

      provider.setFullscreen(false);
      await flushPromises();

      expect(screenfull.exit).toHaveBeenCalled();
    });
  });

  describe('should track fullscreen requests', () => {
    const requestFullscreen = (): Promise<unknown> => {
      setScreenfulEnabled(true);
      setScreenfulFullscreen(false);
      const documentVisibility = createDocumentVisibility();
      const provider = new ScreenfullFullScreenProvider(
        createCardAPI(),
        vi.fn(),
        documentVisibility,
      );

      provider.setFullscreen(true);

      const tracked = documentVisibility.trackFullscreenRequest.mock.calls[0]?.[0];
      assert(tracked);
      return tracked;
    };

    const isSettled = async (promise: Promise<unknown>): Promise<boolean> => {
      let settled = false;
      promise.then(
        () => (settled = true),
        () => (settled = true),
      );
      await flushPromises();
      return settled;
    };

    const getHandler = (name: 'change' | 'error'): ((event: Event) => void) | null => {
      const call = vi.mocked(screenfull.on).mock.calls.find(([event]) => event === name);
      return call?.[1] ?? null;
    };

    it('should track a request that resolves until fullscreen changes', async () => {
      const request = createPromiseWithResolvers();
      vi.mocked(screenfull.request).mockReturnValue(request.promise);

      const tracked = requestFullscreen();
      request.resolve();
      expect(await isSettled(tracked)).toBe(false);

      const changeHandler = getHandler('change');
      assert(changeHandler);
      changeHandler(new Event('fullscreenchange'));

      expect(await isSettled(tracked)).toBe(true);
    });

    it('should track a request until it rejects', async () => {
      const request = createPromiseWithResolvers();
      vi.mocked(screenfull.request).mockReturnValue(request.promise);

      const tracked = requestFullscreen();
      expect(await isSettled(tracked)).toBe(false);

      request.reject(new Error('denied'));

      await expect(tracked).resolves.toBeUndefined();
    });

    it('should track a request until a fullscreen error', async () => {
      vi.mocked(screenfull.request).mockReturnValue(new Promise(() => {}));

      const tracked = requestFullscreen();
      expect(await isSettled(tracked)).toBe(false);

      const errorHandler = getHandler('error');
      assert(errorHandler);
      errorHandler(new Event('fullscreenerror'));

      expect(await isSettled(tracked)).toBe(true);
    });

    it('should stop listening for fullscreen events once a request settles', async () => {
      vi.mocked(screenfull.request).mockReturnValue(new Promise(() => {}));
      const tracked = requestFullscreen();

      const changeHandler = getHandler('change');
      assert(changeHandler);
      changeHandler(new Event('fullscreenchange'));
      await tracked;

      expect(screenfull.off).toHaveBeenCalledWith('change', changeHandler);
      expect(screenfull.off).toHaveBeenCalledWith('error', getHandler('error'));
    });

    describe('should limit how long a request is tracked', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should stop tracking a request that neither completes nor fails', async () => {
        vi.mocked(screenfull.request).mockReturnValue(new Promise(() => {}));

        const tracked = requestFullscreen();

        await vi.advanceTimersByTimeAsync(4999);
        expect(await isSettled(tracked)).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        expect(await isSettled(tracked)).toBe(true);
        expect(screenfull.off).toHaveBeenCalledWith('change', getHandler('change'));
        expect(screenfull.off).toHaveBeenCalledWith('error', getHandler('error'));
      });

      it('should stop the limit once fullscreen changes', async () => {
        vi.mocked(screenfull.request).mockReturnValue(new Promise(() => {}));
        const tracked = requestFullscreen();
        expect(vi.getTimerCount()).toBe(1);

        const changeHandler = getHandler('change');
        assert(changeHandler);
        changeHandler(new Event('fullscreenchange'));
        await tracked;

        expect(vi.getTimerCount()).toBe(0);
      });
    });

    it('should not track a request made while already in fullscreen', () => {
      setScreenfulEnabled(true);
      setScreenfulFullscreen(true);
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const documentVisibility = createDocumentVisibility();
      const provider = new ScreenfullFullScreenProvider(
        api,
        vi.fn(),
        documentVisibility,
      );

      provider.setFullscreen(true);

      expect(screenfull.request).toHaveBeenCalledWith(element);
      expect(documentVisibility.trackFullscreenRequest).not.toHaveBeenCalled();
    });

    it('should not track a fullscreen exit', () => {
      setScreenfulEnabled(true);
      const documentVisibility = createDocumentVisibility();
      const provider = new ScreenfullFullScreenProvider(
        createCardAPI(),
        vi.fn(),
        documentVisibility,
      );

      provider.setFullscreen(false);

      expect(documentVisibility.trackFullscreenRequest).not.toHaveBeenCalled();
    });
  });
});
