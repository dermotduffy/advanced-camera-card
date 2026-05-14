import { describe, expect, it } from 'vitest';
import {
  getStreamCameraID,
  hasSubstream,
  SubstreamOffViewModifier,
  SubstreamOnViewModifier,
  SubstreamSelectViewModifier,
} from '../../../src/components-lib/live/substream';
import { View } from '../../../src/view/view';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createStore,
  createView,
} from '../../test-utils';

describe('getStreamCameraID / hasSubstream', () => {
  it('should report a substream override', () => {
    const view = createView({
      camera: 'camera',
      context: {
        live: {
          overrides: new Map([['camera', 'camera2']]),
        },
      },
    });
    expect(hasSubstream(view)).toBeTruthy();
    expect(getStreamCameraID(view)).toBe('camera2');
  });

  it('should not report a substream when absent', () => {
    const view = createView({ camera: 'camera' });
    expect(hasSubstream(view)).toBeFalsy();
    expect(getStreamCameraID(view)).toBe('camera');
  });

  it('should not report a substream when the override points at the main stream', () => {
    const view = createView({
      camera: 'camera',
      context: {
        live: {
          overrides: new Map([['camera', 'camera']]),
        },
      },
    });
    expect(hasSubstream(view)).toBeFalsy();
    expect(getStreamCameraID(view)).toBe('camera');
  });

  describe('should respect explicit cameraID argument', () => {
    it('when the cameraID has an override', () => {
      const view = createView({
        camera: 'camera',
        context: {
          live: {
            overrides: new Map([
              ['camera', 'camera2'],
              ['camera3', 'camera4'],
            ]),
          },
        },
      });
      expect(hasSubstream(view)).toBeTruthy();
      expect(getStreamCameraID(view, 'camera3')).toBe('camera4');
    });

    it('when the cameraID has no override', () => {
      const view = createView();
      expect(hasSubstream(view)).toBeFalsy();
      expect(getStreamCameraID(view, 'camera3')).toBe('camera3');
    });
  });

  it('should handle a null camera', () => {
    expect(getStreamCameraID(createView({ camera: null }))).toBeNull();
    expect(hasSubstream(createView({ camera: null }))).toBeFalsy();
  });
});

describe('SubstreamSelectViewModifier', () => {
  it('should write the override', () => {
    const view = createView({ camera: 'camera1' });
    new SubstreamSelectViewModifier('substream1').modify(view);
    expect(view.context?.live?.overrides?.get('camera1')).toBe('substream1');
  });

  it('should no-op for a view without a camera', () => {
    const view = createView({ camera: null });
    new SubstreamSelectViewModifier('substream1').modify(view);
    expect(view.context).toBeNull();
  });
});

describe('SubstreamOffViewModifier', () => {
  it('should clear an active override', () => {
    const view = new View({
      view: 'live',
      camera: 'camera',
      context: { live: { overrides: new Map([['camera', 'camera2']]) } },
    });
    new SubstreamOffViewModifier().modify(view);
    expect(view.context).toEqual({ live: { overrides: new Map() } });
  });

  it('should leave unrelated overrides untouched', () => {
    const view = new View({
      view: 'live',
      camera: 'camera-without-override',
      context: { live: { overrides: new Map([['other-camera', 'override']]) } },
    });
    new SubstreamOffViewModifier().modify(view);
    expect(view.context).toEqual({
      live: { overrides: new Map([['other-camera', 'override']]) },
    });
  });

  it('should no-op when the view has no camera', () => {
    const view = createView({ camera: null });
    new SubstreamOffViewModifier().modify(view);
    expect(view.context).toBeNull();
  });
});

describe('SubstreamOnViewModifier', () => {
  const createCameraManagerWithSubstreams = () => {
    const store = createStore([
      {
        cameraID: 'camera.office',
        capabilities: createCapabilities({ live: true, substream: true }),
        config: createCameraConfig({ dependencies: { all_cameras: true } }),
      },
      {
        cameraID: 'camera.kitchen',
        capabilities: createCapabilities({ substream: true }),
      },
    ]);
    return createCameraManager(store);
  };

  it('should advance to the next dependency', () => {
    const cameraManager = createCameraManagerWithSubstreams();
    const view = createView({ view: 'live', camera: 'camera.office' });

    new SubstreamOnViewModifier(cameraManager).modify(view);

    expect(getStreamCameraID(view)).toBe('camera.kitchen');
  });

  it('should wrap back to the parent camera', () => {
    const cameraManager = createCameraManagerWithSubstreams();
    const view = createView({
      view: 'live',
      camera: 'camera.office',
      context: {
        live: { overrides: new Map([['camera.office', 'camera.kitchen']]) },
      },
    });

    new SubstreamOnViewModifier(cameraManager).modify(view);

    expect(getStreamCameraID(view)).toBe('camera.office');
  });

  it('should treat a malformed override as the start of the cycle', () => {
    const cameraManager = createCameraManagerWithSubstreams();
    const view = createView({
      view: 'live',
      camera: 'camera.office',
      context: {
        live: { overrides: new Map([['camera.office', 'NOT_A_REAL_CAMERA']]) },
      },
    });

    new SubstreamOnViewModifier(cameraManager).modify(view);

    expect(getStreamCameraID(view)).toBe('camera.office');
  });

  it('should no-op when there are no usable dependencies', () => {
    const cameraManager = createCameraManager(createStore());
    const view = createView({ view: 'live', camera: 'camera.office' });

    new SubstreamOnViewModifier(cameraManager).modify(view);

    expect(hasSubstream(view)).toBeFalsy();
  });

  it('should no-op when the view has no camera', () => {
    const cameraManager = createCameraManagerWithSubstreams();
    const view = createView({ view: 'live', camera: null });

    new SubstreamOnViewModifier(cameraManager).modify(view);

    expect(view.context).toBeNull();
  });
});
