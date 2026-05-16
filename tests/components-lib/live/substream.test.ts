import { describe, expect, it } from 'vitest';
import {
  getStreamCameraID,
  hasSubstream,
  SubstreamViewModifier,
} from '../../../src/components-lib/live/substream';
import { createView } from '../../test-utils';

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

describe('SubstreamViewModifier', () => {
  it('should write the override for the selected camera', () => {
    const view = createView({ camera: 'camera' });

    new SubstreamViewModifier('substream').modify(view);

    expect(view.context?.live?.overrides?.get('camera')).toBe('substream');
  });

  it('should clear the selected camera override when no substream is given', () => {
    const view = createView({
      camera: 'camera',
      context: { live: { overrides: new Map([['camera', 'substream']]) } },
    });

    new SubstreamViewModifier().modify(view);

    expect(view.context?.live?.overrides?.get('camera')).toBeUndefined();
  });

  it('should write the override for an explicit camera', () => {
    const view = createView({
      camera: 'camera',
      context: { live: { overrides: new Map([['camera', 'substream']]) } },
    });

    new SubstreamViewModifier('other-substream', 'other-camera').modify(view);

    expect(view.context?.live?.overrides?.get('other-camera')).toBe('other-substream');
    expect(view.context?.live?.overrides?.get('camera')).toBe('substream');
  });

  it('should clear the override for an explicit camera', () => {
    const view = createView({
      camera: 'camera',
      context: { live: { overrides: new Map([['other-camera', 'other-substream']]) } },
    });

    new SubstreamViewModifier(undefined, 'other-camera').modify(view);

    expect(view.context?.live?.overrides?.get('other-camera')).toBeUndefined();
  });

  it('should no-op for a view without a camera', () => {
    const view = createView({ camera: null });

    new SubstreamViewModifier('substream').modify(view);

    expect(view.context).toBeNull();
  });
});
