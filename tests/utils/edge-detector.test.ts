import { describe, expect, it } from 'vitest';
import { EdgeDetector } from '../../src/utils/edge-detector';

describe('EdgeDetector', () => {
  it('should report no edge on the first value', () => {
    expect(new EdgeDetector().update(true)).toBeNull();
    expect(new EdgeDetector().update(false)).toBeNull();
  });

  it('should report a rising edge', () => {
    const detector = new EdgeDetector();
    detector.update(false);
    expect(detector.update(true)).toBe('rising');
  });

  it('should report a falling edge', () => {
    const detector = new EdgeDetector();
    detector.update(true);
    expect(detector.update(false)).toBe('falling');
  });

  it('should report no edge when the value is unchanged', () => {
    const detector = new EdgeDetector();
    detector.update(true);
    expect(detector.update(true)).toBeNull();
    expect(detector.update(true)).toBeNull();
  });

  it('should track successive transitions', () => {
    const detector = new EdgeDetector();
    expect(detector.update(false)).toBeNull();
    expect(detector.update(true)).toBe('rising');
    expect(detector.update(false)).toBe('falling');
    expect(detector.update(true)).toBe('rising');
  });
});
