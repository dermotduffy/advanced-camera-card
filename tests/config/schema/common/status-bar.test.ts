import { describe, expect, it } from 'vitest';
import {
  STATUS_BAR_PRIORITY_DEFAULT,
  STATUS_BAR_PRIORITY_MAX,
} from '../../../../src/config/schema/common/const';
import { statusBarItemBaseSchema } from '../../../../src/config/schema/common/status-bar';

describe('statusBarItemBaseSchema', () => {
  it('should default priority/enabled/permanent', () => {
    expect(
      statusBarItemBaseSchema.parse({
        enabled: undefined,
        permanent: undefined,
        priority: undefined,
      }),
    ).toEqual({
      enabled: true,
      permanent: false,
      priority: STATUS_BAR_PRIORITY_DEFAULT,
    });
  });

  it('should accept boundary priorities', () => {
    expect(statusBarItemBaseSchema.parse({ priority: 0 }).priority).toBe(0);
    expect(
      statusBarItemBaseSchema.parse({ priority: STATUS_BAR_PRIORITY_MAX }).priority,
    ).toBe(STATUS_BAR_PRIORITY_MAX);
  });

  it('should reject a priority below 0', () => {
    expect(statusBarItemBaseSchema.safeParse({ priority: -1 }).success).toBe(false);
  });

  it('should reject a priority above the maximum', () => {
    expect(
      statusBarItemBaseSchema.safeParse({ priority: STATUS_BAR_PRIORITY_MAX + 1 })
        .success,
    ).toBe(false);
  });

  it('should reject non-boolean enabled/permanent', () => {
    expect(statusBarItemBaseSchema.safeParse({ enabled: 'yes' }).success).toBe(false);
    expect(statusBarItemBaseSchema.safeParse({ permanent: 1 }).success).toBe(false);
  });
});
