import { describe, expect, it } from 'vitest';

import { formatISODate } from '../../../src/utils/date/iso';

describe('formatISODate', () => {
  it('should format date', () => {
    const date = new Date(2023, 3, 14, 13, 35, 0);
    expect(formatISODate(date)).toBe('2023-04-14');
  });
});
