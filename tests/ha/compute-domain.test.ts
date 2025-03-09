import { describe, it, expect } from 'vitest';
import { computeDomain } from '../../src/ha/compute-domain.js';

describe('computeDomain', () => {
  it('should return the domain of an entity ID', () => {
    expect(computeDomain('light.kitchen')).toBe('light');
    expect(computeDomain('sensor.temperature')).toBe('sensor');
    expect(computeDomain('switch.garage')).toBe('switch');
  });

  it('should return an empty string if there is no dot in the entity ID', () => {
    expect(computeDomain('invalidEntityId')).toBe('');
  });

  it('should handle entity IDs with multiple dots correctly', () => {
    expect(computeDomain('light.kitchen.ceiling')).toBe('light');
  });

  it('should return an empty string for an empty entity ID', () => {
    expect(computeDomain('')).toBe('');
  });

  it('should return an empty string for a dot-only entity ID', () => {
    expect(computeDomain('.')).toBe('');
  });
});
