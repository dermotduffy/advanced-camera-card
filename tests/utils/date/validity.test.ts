import { describe, expect, it } from 'vitest';

import { isValidDate, isValidDay } from '../../../src/utils/date/validity';

describe('isValidDate', () => {
  it('should be valid date', () => {
    expect(isValidDate(new Date(2023, 3, 28))).toBeTruthy();
  });
  it('should be invalid date', () => {
    expect(isValidDate(new Date('moo'))).toBeFalsy();
  });
});

describe('isValidDay', () => {
  it('should accept a day that exists', () => {
    expect(isValidDay('2023-05-06')).toBeTruthy();
  });

  it('should reject a day past the end of its month', () => {
    expect(isValidDay('2023-02-31')).toBeFalsy();
  });

  it('should reject a month that does not exist', () => {
    expect(isValidDay('2023-13-01')).toBeFalsy();
  });
});
