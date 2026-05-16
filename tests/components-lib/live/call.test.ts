import { describe, expect, it } from 'vitest';
import {
  CallClearViewModifier,
  CallSetViewModifier,
  isCallActive,
} from '../../../src/components-lib/live/call';
import { createView } from '../../test-utils';

describe('isCallActive', () => {
  it('should be false without a call context', () => {
    expect(isCallActive(createView())).toBe(false);
  });

  it('should be false for a null view', () => {
    expect(isCallActive(null)).toBe(false);
  });

  it('should be true with a call context', () => {
    const view = createView({
      camera: 'camera',
      context: { call: { cameraID: 'camera', callCameraID: 'camera' } },
    });
    expect(isCallActive(view)).toBe(true);
  });
});

describe('CallSetViewModifier', () => {
  it('should set the call context', () => {
    const view = createView({ camera: 'camera' });

    new CallSetViewModifier({ cameraID: 'camera', callCameraID: 'camera' }).modify(view);

    expect(view.context?.call).toEqual({
      cameraID: 'camera',
      callCameraID: 'camera',
    });
  });

  it('should write a substream override when the call camera differs', () => {
    const view = createView({ camera: 'camera' });

    new CallSetViewModifier({
      cameraID: 'camera',
      callCameraID: 'camera-dependency',
    }).modify(view);

    expect(view.context?.live?.overrides?.get('camera')).toBe('camera-dependency');
  });

  it('should clear an existing substream override when the call camera matches', () => {
    const view = createView({
      camera: 'camera',
      context: { live: { overrides: new Map([['camera', 'camera-other']]) } },
    });

    new CallSetViewModifier({ cameraID: 'camera', callCameraID: 'camera' }).modify(view);

    expect(view.context?.live?.overrides?.get('camera')).toBeUndefined();
  });
});

describe('CallClearViewModifier', () => {
  it('should no-op without a call context', () => {
    const view = createView({ camera: 'camera' });
    new CallClearViewModifier().modify(view);
    expect(view.context?.call).toBeUndefined();
  });

  it('should clear the call context', () => {
    const view = createView({
      camera: 'camera',
      context: { call: { cameraID: 'camera', callCameraID: 'camera' } },
    });

    new CallClearViewModifier().modify(view);

    expect(view.context?.call).toBeUndefined();
  });

  it('should clear the substream override when there was no pre-call override', () => {
    const view = createView({
      camera: 'camera',
      context: {
        call: { cameraID: 'camera', callCameraID: 'camera-dependency' },
        live: { overrides: new Map([['camera', 'camera-dependency']]) },
      },
    });

    new CallClearViewModifier().modify(view);

    expect(view.context?.live?.overrides?.get('camera')).toBeUndefined();
  });

  it('should restore the pre-call substream override when no override map exists', () => {
    const view = createView({
      camera: 'camera',
      context: {
        call: {
          cameraID: 'camera',
          callCameraID: 'camera-dependency',
          preCallSubstream: 'camera-prior',
        },
      },
    });

    new CallClearViewModifier().modify(view);

    expect(view.context?.live?.overrides?.get('camera')).toBe('camera-prior');
  });

  it('should restore the pre-call substream override', () => {
    const view = createView({
      camera: 'camera',
      context: {
        call: {
          cameraID: 'camera',
          callCameraID: 'camera-dependency',
          preCallSubstream: 'camera-prior',
        },
        live: { overrides: new Map([['camera', 'camera-dependency']]) },
      },
    });

    new CallClearViewModifier().modify(view);

    expect(view.context?.live?.overrides?.get('camera')).toBe('camera-prior');
  });
});
