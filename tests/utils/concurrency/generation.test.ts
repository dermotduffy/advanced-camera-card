import { describe, expect, it } from 'vitest';

import { Generation } from '../../../src/utils/concurrency/generation';

describe('Generation', () => {
  it('should treat a fresh snapshot as current', () => {
    const generation = new Generation();

    expect(generation.isCurrent(generation.current())).toBe(true);
  });

  it('should keep a snapshot current across further snapshots', () => {
    const generation = new Generation();
    const token = generation.current();

    generation.current();

    expect(generation.isCurrent(token)).toBe(true);
  });

  it('should invalidate outstanding snapshots', () => {
    const generation = new Generation();
    const token = generation.current();

    generation.invalidate();

    expect(generation.isCurrent(token)).toBe(false);
  });

  it('should invalidate prior tokens when starting a new operation', () => {
    const generation = new Generation();
    const first = generation.next();
    const second = generation.next();

    expect(generation.isCurrent(first)).toBe(false);
    expect(generation.isCurrent(second)).toBe(true);
  });
});
