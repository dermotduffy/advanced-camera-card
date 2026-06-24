import { describe, expect, it } from 'vitest';

import { isTemplateTrue } from '../../../../src/condition-trigger/conditions/conditions/is-template-true';

describe('condition isTemplateTrue', () => {
  it('should accept boolean true', () => {
    expect(isTemplateTrue(true)).toBe(true);
  });

  it('should accept the string "true" case-insensitively', () => {
    expect(isTemplateTrue('true')).toBe(true);
    expect(isTemplateTrue('TRUE')).toBe(true);
  });

  it('should reject other truthy-looking values for HA symmetry', () => {
    for (const value of ['yes', 'on', '1', 'enable', false, 0, null, undefined]) {
      expect(isTemplateTrue(value)).toBe(false);
    }
  });
});
