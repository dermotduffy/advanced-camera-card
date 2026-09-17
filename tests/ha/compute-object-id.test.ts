import { describe, expect, it } from 'vitest';

import { computeObjectId } from '../../src/ha/compute-object-id.js';

describe('computeObjectId', () => {
  it('should return the object ID of an entity ID', () => {
    expect(computeObjectId('light.kitchen')).toBe('kitchen');
    expect(computeObjectId('sensor.temperature')).toBe('temperature');
    expect(computeObjectId('switch.garage')).toBe('garage');
  });

  it('should return the whole entity ID if there is no dot in it', () => {
    expect(computeObjectId('invalidEntityId')).toBe('invalidEntityId');
  });

  it('should handle entity IDs with multiple dots correctly', () => {
    expect(computeObjectId('light.kitchen.ceiling')).toBe('kitchen.ceiling');
  });

  it('should return an empty string for an empty entity ID', () => {
    expect(computeObjectId('')).toBe('');
  });

  it('should return an empty string for a dot-only entity ID', () => {
    expect(computeObjectId('.')).toBe('');
  });
});
