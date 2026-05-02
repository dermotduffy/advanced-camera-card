import { describe, expect, it } from 'vitest';
import { QueryResults } from '../../src/view/query-results';
import {
  getViewTargetID,
  IMAGE_VIEW_TARGET_ID_SENTINEL,
} from '../../src/view/target-id';
import { createView, generateViewMediaArray } from '../test-utils';

describe('getViewTargetID', () => {
  describe('live', () => {
    it('should return the base camera ID', () => {
      const view = createView({ view: 'live', camera: 'camera.front_door' });
      expect(getViewTargetID(view)).toBe('camera.front_door');
    });

    it('should return the base camera ID even though substream override is active', () => {
      // Substream is a playback-layer detail; targetID stays the base camera
      // throughout substream toggles so consumers above the provider don't
      // need to know about substreams.
      const view = createView({
        view: 'live',
        camera: 'camera.front_door',
        context: {
          live: {
            overrides: new Map([['camera.front_door', 'camera.front_door_lq']]),
          },
        },
      });
      expect(getViewTargetID(view)).toBe('camera.front_door');
    });
  });

  describe('viewer', () => {
    it('should return the selected media ID', () => {
      const media = generateViewMediaArray({ count: 3 });
      const view = createView({
        view: 'media',
        camera: 'camera.front_door',
        queryResults: new QueryResults({ results: media, selectedIndex: 1 }),
      });
      expect(getViewTargetID(view)).toBe(media[1].getID());
    });

    it('should return null when there is no selection', () => {
      const view = createView({
        view: 'media',
        camera: 'camera.front_door',
      });
      expect(getViewTargetID(view)).toBeNull();
    });
  });

  describe('image', () => {
    it('should return the sentinel', () => {
      const view = createView({ view: 'image', camera: 'camera.front_door' });
      expect(getViewTargetID(view)).toBe(IMAGE_VIEW_TARGET_ID_SENTINEL);
    });
  });

  describe('other view types', () => {
    it.each(['clips', 'snapshots', 'recordings', 'recording'] as const)(
      'should return null for %s',
      (viewName) => {
        const view = createView({ view: viewName, camera: 'camera.front_door' });
        expect(getViewTargetID(view)).toBeNull();
      },
    );
  });
});
