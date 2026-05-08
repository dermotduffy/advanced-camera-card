import { describe, expect, it } from 'vitest';
import { regexSchema } from '../../../../src/config/schema/common/regex';

describe('regexSchema', () => {
  it('should accept a valid regular expression', () => {
    expect(regexSchema.parse('^[a-z]+$')).toBe('^[a-z]+$');
  });

  it('should accept the empty string', () => {
    expect(regexSchema.parse('')).toBe('');
  });

  it('should reject a malformed regular expression', () => {
    const result = regexSchema.safeParse('[unclosed');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Invalid regular expression');
  });

  it('should reject non-string input', () => {
    expect(regexSchema.safeParse(123).success).toBe(false);
  });
});
