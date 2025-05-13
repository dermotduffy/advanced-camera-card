import { describe, expect, it } from 'vitest';
import { supportsFeature } from '../../src/ha/supports-feature';
import { createStateEntity } from '../test-utils';

describe('supportsFeature', () => {
  it('returns true if the feature bit is set', () => {
    const stateObj = createStateEntity({
      attributes: { supported_features: 4 },
    });
    expect(supportsFeature(stateObj, 4)).toBe(true);
  });

  it('returns false if the feature bit is not set', () => {
    const stateObj = createStateEntity({
      attributes: { supported_features: 2 },
    });
    expect(supportsFeature(stateObj, 4)).toBe(false);
  });

  it('returns false if supported_features is undefined', () => {
    const stateObj = createStateEntity({
      attributes: {},
    });
    expect(supportsFeature(stateObj, 1)).toBe(false);
  });

  it('returns true if multiple feature bits are set and one matches', () => {
    const stateObj = createStateEntity({
      attributes: { supported_features: 6 }, // 2 + 4
    });
    expect(supportsFeature(stateObj, 2)).toBe(true);
    expect(supportsFeature(stateObj, 4)).toBe(true);
  });

  it('returns false if feature is 0', () => {
    const stateObj = createStateEntity({
      attributes: { supported_features: 7 },
    });
    expect(supportsFeature(stateObj, 0)).toBe(false);
  });
});
