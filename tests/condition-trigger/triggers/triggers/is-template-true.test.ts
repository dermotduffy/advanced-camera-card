import { describe, expect, it } from 'vitest';

import { isTemplateTrue } from '../../../../src/condition-trigger/triggers/triggers/is-template-true';

describe('trigger isTemplateTrue', () => {
  it('should pass booleans through', () => {
    expect(isTemplateTrue(true)).toBe(true);
    expect(isTemplateTrue(false)).toBe(false);
  });

  it('should treat a non-zero number as true', () => {
    expect(isTemplateTrue(1)).toBe(true);
    expect(isTemplateTrue(0)).toBe(false);
  });

  it('should accept HA truthy strings case-insensitively', () => {
    for (const value of ['1', 'true', 'YES', 'On', 'enable']) {
      expect(isTemplateTrue(value)).toBe(true);
    }
  });

  it('should reject falsey strings and other types', () => {
    for (const value of ['0', 'false', 'no', 'off', 'disable', 'whatever']) {
      expect(isTemplateTrue(value)).toBe(false);
    }
    expect(isTemplateTrue(null)).toBe(false);
    expect(isTemplateTrue(undefined)).toBe(false);
    expect(isTemplateTrue({})).toBe(false);
  });
});
