import { describe, expect, it } from 'vitest';

import { recordingSummarySchema } from '../../../src/camera-manager/frigate/types';

describe('recordingSummarySchema', () => {
  it('should reject a day that is not in YYYY-MM-DD form', () => {
    expect(() =>
      recordingSummarySchema.parse([
        {
          day: '6th May 2023',
          events: 5,
          hours: [],
        },
      ]),
    ).toThrow();
  });

  it('should reject a day that is not a real calendar date', () => {
    expect(() =>
      recordingSummarySchema.parse([
        {
          day: '2023-02-31',
          events: 5,
          hours: [],
        },
      ]),
    ).toThrow();
  });

  it('should preprocess hour from string to number', () => {
    const result = recordingSummarySchema.parse([
      {
        day: '2023-05-06',
        events: 3,
        hours: [{ hour: '15', duration: 3600, events: 3 }],
      },
    ]);
    expect(result[0].hours[0].hour).toBe(15);
  });
});
