import { describe, expect, it } from 'vitest';
import { recordingSummarySchema } from '../../../src/camera-manager/frigate/types';

describe('recordingSummarySchema', () => {
  it('should parse day string to date', () => {
    const result = recordingSummarySchema.parse([
      {
        day: '2023-05-06',
        events: 10,
        hours: [],
      },
    ]);
    expect(result[0].day).toBeInstanceOf(Date);
    expect(result[0].day.getFullYear()).toBe(2023);
  });

  it('should pass through non-string day values', () => {
    const date = new Date('2023-05-06');
    const result = recordingSummarySchema.parse([
      {
        day: date,
        events: 5,
        hours: [],
      },
    ]);
    expect(result[0].day).toEqual(date);
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
