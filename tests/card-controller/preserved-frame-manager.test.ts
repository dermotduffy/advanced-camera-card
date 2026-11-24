import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { PreservedFrameManager } from '../../src/card-controller/preserved-frame-manager';
import type { MediaPlayerController } from '../../src/types';
import { PreservedFrameStore } from '../../src/utils/preserved-frame-store';
import { createCameraManager, createStore } from '../camera-manager/test-utils';
import { createCameraConfig, createConfig } from '../config/test-utils';
import { createCardAPI } from '../test-utils';
import { createPreservedFrame } from '../utils/test-utils';

const date = new Date('2026-11-17T12:00:00');

// A card with one camera, `camera-1`, that preserves frames for the given
// number of seconds.
const createAPI = (options?: { preserveFrameSeconds?: number; cardID?: string }) => {
  const api = createCardAPI();
  vi.mocked(api.getCameraManager).mockReturnValue(
    createCameraManager(
      createStore([
        {
          cameraID: 'camera-1',
          config: createCameraConfig({
            image: { preserve_frame_seconds: options?.preserveFrameSeconds ?? 60 },
          }),
        },
      ]),
    ),
  );
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
    createConfig({ card_id: options?.cardID }),
  );
  return api;
};

const createPlayer = (url: string | null = 'data:image/jpeg;base64,frame') => {
  const player = mock<MediaPlayerController>();
  player.getFrameURL.mockResolvedValue(url);
  return player;
};

describe('PreservedFrameManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(date);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('should capture frames', () => {
    it('should preserve the frame of a player along with its capture date', async () => {
      const manager = new PreservedFrameManager(createAPI(), new PreservedFrameStore());
      const player = createPlayer();

      await manager.capture('camera-1', player);

      expect(player.getFrameURL).toHaveBeenCalledWith(true);
      expect(manager.get('camera-1')).toEqual(createPreservedFrame());
    });

    it('should preserve nothing when the camera does not preserve frames', async () => {
      const manager = new PreservedFrameManager(
        createAPI({ preserveFrameSeconds: 0 }),
        new PreservedFrameStore(),
      );
      const player = createPlayer();

      await manager.capture('camera-1', player);

      expect(player.getFrameURL).not.toHaveBeenCalled();
    });

    it('should preserve nothing for an unknown camera', async () => {
      const manager = new PreservedFrameManager(createAPI(), new PreservedFrameStore());
      const player = createPlayer();

      await manager.capture('camera-unknown', player);

      expect(player.getFrameURL).not.toHaveBeenCalled();
      expect(manager.has('camera-unknown')).toBe(false);
    });

    it('should preserve nothing when the player has no frame', async () => {
      const manager = new PreservedFrameManager(createAPI(), new PreservedFrameStore());

      await manager.capture('camera-1', createPlayer(null));

      expect(manager.has('camera-1')).toBe(false);
    });

    it('should date a frame by when its capture started', async () => {
      const manager = new PreservedFrameManager(createAPI(), new PreservedFrameStore());
      const player = mock<MediaPlayerController>();
      player.getFrameURL.mockImplementation(async () => {
        vi.advanceTimersByTime(10 * 1000);
        return 'data:image/jpeg;base64,frame';
      });

      await manager.capture('camera-1', player);

      expect(manager.get('camera-1')?.date).toEqual(date);
    });
  });

  describe('should look up frames', () => {
    it('should have no frame before one is captured', () => {
      const manager = new PreservedFrameManager(createAPI(), new PreservedFrameStore());

      expect(manager.get('camera-1')).toBeNull();
      expect(manager.has('camera-1')).toBe(false);
    });

    it('should have a frame once one is captured', async () => {
      const manager = new PreservedFrameManager(createAPI(), new PreservedFrameStore());

      await manager.capture('camera-1', createPlayer());

      expect(manager.has('camera-1')).toBe(true);
    });

    it('should not return a frame older than the camera allows', async () => {
      const manager = new PreservedFrameManager(createAPI(), new PreservedFrameStore());
      await manager.capture('camera-1', createPlayer());

      vi.advanceTimersByTime(60 * 1000);

      expect(manager.get('camera-1')).toBeNull();
      expect(manager.has('camera-1')).toBe(false);
    });

    it('should return the seconds until a frame expires', () => {
      const manager = new PreservedFrameManager(createAPI(), new PreservedFrameStore());
      const frame = createPreservedFrame();

      vi.advanceTimersByTime(20 * 1000);

      expect(manager.getSecondsUntilExpired('camera-1', frame)).toBe(40);
    });

    it('should find a frame preserved by another card with the same card_id', async () => {
      const store = new PreservedFrameStore();
      await new PreservedFrameManager(createAPI({ cardID: 'card-1' }), store).capture(
        'camera-1',
        createPlayer(),
      );

      const manager = new PreservedFrameManager(createAPI({ cardID: 'card-1' }), store);

      expect(manager.has('camera-1')).toBe(true);
    });

    it('should not find a frame preserved by a card with another card_id', async () => {
      const store = new PreservedFrameStore();
      await new PreservedFrameManager(createAPI({ cardID: 'card-1' }), store).capture(
        'camera-1',
        createPlayer(),
      );

      const manager = new PreservedFrameManager(createAPI({ cardID: 'card-2' }), store);

      expect(manager.has('camera-1')).toBe(false);
    });

    it('should use the shared store by default', async () => {
      const first = new PreservedFrameManager(createAPI({ cardID: 'shared-store' }));
      await first.capture('camera-1', createPlayer());

      const second = new PreservedFrameManager(createAPI({ cardID: 'shared-store' }));

      expect(second.has('camera-1')).toBe(true);
    });
  });

  describe('should tell subscribers of new frames', () => {
    it('should call back when a frame is preserved for the camera by any card sharing its frames', async () => {
      const store = new PreservedFrameStore();
      const manager = new PreservedFrameManager(createAPI({ cardID: 'card-1' }), store);
      const callback = vi.fn();
      manager.subscribe('camera-1', callback);

      await new PreservedFrameManager(createAPI({ cardID: 'card-1' }), store).capture(
        'camera-1',
        createPlayer(),
      );

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not call back for a frame of another camera or card', () => {
      const store = new PreservedFrameStore();
      const manager = new PreservedFrameManager(createAPI({ cardID: 'card-1' }), store);
      const callback = vi.fn();
      manager.subscribe('camera-1', callback);

      store.set({ cardID: 'card-1', cameraID: 'camera-2' }, createPreservedFrame());
      store.set({ cardID: 'card-2', cameraID: 'camera-1' }, createPreservedFrame());
      store.set({ cameraID: 'camera-1' }, createPreservedFrame());

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not call back once unsubscribed', async () => {
      const manager = new PreservedFrameManager(createAPI(), new PreservedFrameStore());
      const callback = vi.fn();
      manager.subscribe('camera-1', callback)();

      await manager.capture('camera-1', createPlayer());

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('should track the frame a camera is showing', () => {
    it('should report no shown frame by default', () => {
      const manager = new PreservedFrameManager(createAPI(), new PreservedFrameStore());

      expect(manager.getShowingFrame('camera-1')).toBeNull();
    });

    it('should return a frame while it is shown and update the card', () => {
      const api = createAPI();
      const manager = new PreservedFrameManager(api, new PreservedFrameStore());
      const frame = createPreservedFrame();

      manager.setShowing('camera-1', frame, new AbortController().signal);

      expect(manager.getShowingFrame('camera-1')).toBe(frame);
      expect(manager.getShowingFrame('camera-2')).toBeNull();
      expect(api.getCardElementManager().update).toHaveBeenCalledTimes(1);
    });

    it('should stop returning a frame once its signal aborts and update the card', () => {
      const api = createAPI();
      const manager = new PreservedFrameManager(api, new PreservedFrameStore());
      const abortController = new AbortController();
      manager.setShowing('camera-1', createPreservedFrame(), abortController.signal);

      abortController.abort();

      expect(manager.getShowingFrame('camera-1')).toBeNull();
      expect(api.getCardElementManager().update).toHaveBeenCalledTimes(2);
    });
  });
});
