import { describe, expect, it } from 'vitest';
import { iconSchema } from '../../../../src/config/schema/common/icon';

describe('iconSchema', () => {
  it('should parse icon with all fields', () => {
    expect(
      iconSchema.parse({
        icon: 'mdi:star',
        entity: 'light.office',
        stateColor: true,
      }),
    ).toEqual({
      icon: 'mdi:star',
      entity: 'light.office',
      stateColor: true,
    });
  });

  it('should parse empty object', () => {
    expect(iconSchema.parse({})).toEqual({});
  });
});
