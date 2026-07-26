import screenfull from 'screenfull';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScreenfullFullScreenProvider } from '../../../../src/card-controller/fullscreen/screenfull';
import { createCardAPI, flushPromises, setScreenfulEnabled } from '../../../test-utils';

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

      expect(on).toBeCalledWith('change', expect.anything());
    });

    it('should not connect if not enabled', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());
      const on = vi.mocked(screenfull.on);

      setScreenfulEnabled(false);

      provider.connect();

      expect(on).not.toBeCalled();
    });
  });

  describe('should disconnect', () => {
    it('should disconnect if enabled', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());
      const off = vi.mocked(screenfull.off);

      setScreenfulEnabled(true);

      provider.disconnect();

      expect(off).toBeCalledWith('change', expect.anything());
    });

    it('should not disconnect if not enabled', () => {
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());
      const off = vi.mocked(screenfull.off);

      setScreenfulEnabled(false);

      provider.disconnect();

      expect(off).not.toBeCalled();
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

      expect(screenfull.request).toBeCalledWith(element);
    });

    it('should exit fullscreen if fullscreen is false', () => {
      setScreenfulEnabled(true);

      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());

      provider.setFullscreen(false);

      expect(screenfull.exit).toBeCalled();
    });

    it('should take no action if not supported', () => {
      setScreenfulEnabled(false);

      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const provider = new ScreenfullFullScreenProvider(api, vi.fn());

      provider.setFullscreen(true);
      provider.setFullscreen(false);

      expect(screenfull.request).not.toBeCalled();
      expect(screenfull.exit).not.toBeCalled();
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

      expect(screenfull.request).toBeCalledWith(element);
    });

    it('should swallow a rejected fullscreen exit', async () => {
      setScreenfulEnabled(true);
      vi.mocked(screenfull.exit).mockRejectedValue(new Error('not in fullscreen'));
      const provider = new ScreenfullFullScreenProvider(createCardAPI(), vi.fn());

      provider.setFullscreen(false);
      await flushPromises();

      expect(screenfull.exit).toBeCalled();
    });
  });
});
