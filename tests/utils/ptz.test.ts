import { describe, expect, it, vi } from 'vitest';
import { Capabilities } from '../../src/camera-manager/capabilities';
import { AdvancedCameraCardView } from '../../src/config/schema/common/const';
import { PTZMovementType } from '../../src/types';
import {
  getPTZTarget,
  hasCameraTruePTZ,
  ptzActionToCapabilityKey,
} from '../../src/utils/ptz';
import { QueryResults } from '../../src/view/query-results';
import { IMAGE_VIEW_TARGET_ID_SENTINEL } from '../../src/view/target-id';
import * as targetId from '../../src/view/target-id';
import {
  TestViewMedia,
  createCameraManager,
  createStore,
  createView,
} from '../test-utils';

describe('getPTZTarget', () => {
  describe('in a viewer view', () => {
    it('should return target with media', () => {
      const media = [new TestViewMedia({ id: 'media-id' })];
      const view = createView({
        view: 'media',
        queryResults: new QueryResults({ results: media, selectedIndex: 0 }),
      });
      expect(getPTZTarget(view, { cameraManager: createCameraManager() })).toEqual({
        targetID: 'media-id',
        type: 'digital',
      });
    });

    it('should return null without media', () => {
      const view = createView({
        view: 'media',
      });
      expect(getPTZTarget(view, { cameraManager: createCameraManager() })).toBeNull();
    });

    it('should return null with true PTZ restriction', () => {
      const media = [new TestViewMedia({ id: 'media-id' })];
      const view = createView({
        view: 'media',
        queryResults: new QueryResults({ results: media, selectedIndex: 0 }),
      });
      expect(
        getPTZTarget(view, { type: 'ptz', cameraManager: createCameraManager() }),
      ).toBeNull();
    });
  });

  it('should return target in image view', () => {
    expect(getPTZTarget(createView({ view: 'image' }))).toEqual({
      targetID: IMAGE_VIEW_TARGET_ID_SENTINEL,
      type: 'digital',
    });
  });

  describe('in live view', () => {
    it('should return PTZ target without restriction with true PTZ capability', () => {
      const view = createView({
        view: 'live',
        camera: 'camera-1',
      });
      const store = createStore([
        {
          cameraID: 'camera-1',
          capabilities: new Capabilities({ ptz: { left: [PTZMovementType.Relative] } }),
        },
      ]);

      expect(getPTZTarget(view, { cameraManager: createCameraManager(store) })).toEqual({
        targetID: 'camera-1',
        type: 'ptz',
      });
    });

    it('should return digital target without restriction without true PTZ capability', () => {
      const view = createView({
        view: 'live',
        camera: 'camera-1',
      });

      expect(getPTZTarget(view, { cameraManager: createCameraManager() })).toEqual({
        targetID: 'camera-1',
        type: 'digital',
      });
    });

    it('should return null with truePTZ restriction without true PTZ capability', () => {
      const view = createView({
        view: 'live',
        camera: 'camera-1',
      });

      expect(
        getPTZTarget(view, { type: 'ptz', cameraManager: createCameraManager() }),
      ).toBeNull();
    });

    it('should return digital target with digitalPTZ restriction with true PTZ capability', () => {
      const view = createView({
        view: 'live',
        camera: 'camera-1',
      });
      const store = createStore([
        {
          cameraID: 'camera-1',
          capabilities: new Capabilities({ ptz: { left: [PTZMovementType.Relative] } }),
        },
      ]);

      expect(
        getPTZTarget(view, {
          type: 'digital',
          cameraManager: createCameraManager(store),
        }),
      ).toEqual({
        targetID: 'camera-1',
        type: 'digital',
      });
    });

    it('should return null without cameraID', () => {
      const view = createView({
        view: 'live',
        camera: null,
      });
      expect(getPTZTarget(view, { cameraManager: createCameraManager() })).toBeNull();
    });
  });

  describe('in non-media views', () => {
    it.each([['timeline' as const], ['diagnostics' as const]])(
      '%s',
      (viewName: AdvancedCameraCardView) => {
        const view = createView({
          view: viewName,
        });
        expect(getPTZTarget(view, { cameraManager: createCameraManager() })).toBeNull();
      },
    );
  });

  it('should return null for a view with a targetID that is not viewer, image, or live', () => {
    // Force getViewTargetID to return a non-null value so that the early-return
    // guard passes, then present a view that is none of viewer/image/live to
    // exercise the final return null branch at the end of getPTZTarget.
    vi.spyOn(targetId, 'getViewTargetID').mockReturnValue('some-target');
    const view = createView({ view: 'timeline' });

    expect(getPTZTarget(view)).toBeNull();

    vi.restoreAllMocks();
  });
});

describe('hasCameraTruePTZ', () => {
  it('should return true with true PTZ', () => {
    const store = createStore([
      {
        cameraID: 'camera-1',
        capabilities: new Capabilities({ ptz: { left: [PTZMovementType.Relative] } }),
      },
    ]);

    expect(hasCameraTruePTZ(createCameraManager(store), 'camera-1')).toBeTruthy();
  });

  it('should return false without true PTZ', () => {
    expect(hasCameraTruePTZ(createCameraManager(createStore()), 'camera-1')).toBeFalsy();
  });
});

it('should map ptzActionToCapabilityKey correctly', () => {
  expect(ptzActionToCapabilityKey('left')).toBe('left');
  expect(ptzActionToCapabilityKey('right')).toBe('right');
  expect(ptzActionToCapabilityKey('up')).toBe('up');
  expect(ptzActionToCapabilityKey('down')).toBe('down');
  expect(ptzActionToCapabilityKey('zoom_in')).toBe('zoomIn');
  expect(ptzActionToCapabilityKey('zoom_out')).toBe('zoomOut');
  expect(ptzActionToCapabilityKey('preset')).toBeNull();
});
