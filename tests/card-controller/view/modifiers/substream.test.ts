import { describe, expect, it } from 'vitest';
import { SubstreamViewModifier } from '../../../../src/card-controller/view/modifiers/substream';
import { createView } from '../../../test-utils';

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
