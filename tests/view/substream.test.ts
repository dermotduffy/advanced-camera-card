import { describe, expect, it } from 'vitest';
import { getStreamCameraID, hasSubstream } from '../../src/view/substream';
import { createView } from '../test-utils';

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
