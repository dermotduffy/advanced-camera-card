import { describe, expect, it } from 'vitest';

import { timeDeltaToSeconds } from '../../../../src/card-controller/actions/utils/time-delta';

describe('timeDeltaToSeconds', () => {
  it('hours', () => {
    expect(timeDeltaToSeconds({ h: 1 })).toBe(3600);
  });
  it('minutes', () => {
    expect(timeDeltaToSeconds({ m: 1 })).toBe(60);
  });
  it('seconds', () => {
    expect(timeDeltaToSeconds({ s: 1 })).toBe(1);
  });
  it('milliseconds', () => {
    expect(timeDeltaToSeconds({ ms: 1 })).toBe(0.001);
  });
  it('combination', () => {
    expect(timeDeltaToSeconds({ h: 1, m: 2, s: 3, ms: 4 })).toBe(3723.004);
  });
});
