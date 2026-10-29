import { assert, describe, expect, it } from 'vitest';

import { withHLSStartPosition } from '../../src/utils/hls';

class FakeHls {
  public static Events = { MEDIA_ATTACHED: 'hlsMediaAttached' };

  public config: Record<string, unknown>;

  constructor(config?: Record<string, unknown>) {
    this.config = config ?? {};
  }
}

describe('withHLSStartPosition', () => {
  it('should return the class unchanged without a start position', () => {
    expect(withHLSStartPosition(FakeHls, null)).toBe(FakeHls);
  });

  it('should start players at the start position', () => {
    const Hls = withHLSStartPosition(FakeHls, 42);
    const hls = new Hls({ backBufferLength: 60 });

    assert(hls instanceof FakeHls);
    expect(hls.config).toEqual({ backBufferLength: 60, startPosition: 42 });
  });

  it('should start players at the start position without other config', () => {
    const Hls = withHLSStartPosition(FakeHls, 0);
    const hls = new Hls();

    assert(hls instanceof FakeHls);
    expect(hls.config).toEqual({ startPosition: 0 });
  });

  it('should keep the static members of the class', () => {
    const Hls = withHLSStartPosition(FakeHls, 42) as unknown as typeof FakeHls;

    expect(Hls.Events).toBe(FakeHls.Events);
  });
});
