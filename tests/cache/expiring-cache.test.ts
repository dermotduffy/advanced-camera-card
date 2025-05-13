import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpiringEqualityCache } from '../../src/cache/expiring-cache';

describe('ExpiringEqualityCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set and get a value', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    cache.set('foo', 123);
    expect(cache.get('foo')).toBe(123);
  });

  it('should return null for a non-existent key', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    expect(cache.get('foo')).toBeNull();
  });

  it('should return null for an expired key', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    const expiryDate = new Date(Date.now() + 1000);
    cache.set('foo', 123, expiryDate);
    vi.advanceTimersByTime(1001);
    expect(cache.get('foo')).toBeNull();
  });

  it('should return the value if not expired', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    const expiryDate = new Date(Date.now() + 1000);
    cache.set('foo', 123, expiryDate);
    vi.advanceTimersByTime(500);
    expect(cache.get('foo')).toBe(123);
  });

  it('should correctly report has for existing non-expired key', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    cache.set('foo', 123, new Date(Date.now() + 1000));
    expect(cache.has('foo')).toBe(true);
  });

  it('should correctly report has for existing key with no expiry', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    cache.set('foo', 123);
    expect(cache.has('foo')).toBe(true);
  });

  it('should correctly report not for has for non-existent key', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    expect(cache.has('foo')).toBe(false);
  });

  it('should correctly report not for has for expired key', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    cache.set('foo', 123, new Date(Date.now() + 1000));
    vi.advanceTimersByTime(1001);
    expect(cache.has('foo')).toBe(false);
  });

  it('should delete a key', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    cache.set('foo', 123);
    expect(cache.delete('foo')).toBe(true);
    expect(cache.get('foo')).toBeNull();
    expect(cache.has('foo')).toBe(false);
  });

  it('should return false when deleting a non-existent key', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    expect(cache.delete('foo')).toBe(false);
  });

  it('should clear all keys', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    cache.set('foo', 123);
    cache.set('bar', 456, new Date(Date.now() + 1000));
    cache.clear();
    expect(cache.get('foo')).toBeNull();
    expect(cache.get('bar')).toBeNull();
    expect(cache.has('foo')).toBe(false);
    expect(cache.has('bar')).toBe(false);
  });

  it('should iterate over entries', () => {
    const cache = new ExpiringEqualityCache<string, number>();

    cache.set('forever', 42);
    cache.set('bas', 43, new Date(Date.now()));
    cache.set('foo', 44, new Date(Date.now() + 1000));
    cache.set('bar', 45, new Date(Date.now() + 2000));

    vi.advanceTimersByTime(1001);

    expect([...cache.entries()]).toEqual([
      ['forever', 42],
      ['bar', 45],
    ]);
  });

  it('should return empty iterator for an empty cache', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    const entries = Array.from(cache.entries());
    expect(entries).toHaveLength(0);
  });

  it('should return empty iterator if all entries are expired', () => {
    const cache = new ExpiringEqualityCache<string, number>();
    cache.set('foo', 123, new Date(Date.now() - 1000));
    cache.set('bar', 456, new Date(Date.now() - 500));
    vi.advanceTimersByTime(1); // Ensure current time is past expiry
    const entries = Array.from(cache.entries());
    expect(entries).toHaveLength(0);
  });

  it('should get matches for non-expired values', () => {
    const cache = new ExpiringEqualityCache<string, { id: number; type: string }>();
    cache.set('a', { id: 1, type: 'A' });
    cache.set('b', { id: 2, type: 'B' }, new Date(Date.now() + 1000));
    cache.set('c', { id: 3, type: 'A' }, new Date(Date.now() - 1000)); // expired
    cache.set('d', { id: 4, type: 'A' }, new Date(Date.now() + 500));

    const matches = cache.getMatches((value) => value.type === 'A');
    expect(matches).toHaveLength(2);
    expect(matches).toContainEqual({ id: 1, type: 'A' });
    expect(matches).toContainEqual({ id: 4, type: 'A' });
  });

  it('should return empty array for getMatches on an empty cache', () => {
    const cache = new ExpiringEqualityCache<string, { id: number }>();
    const matches = cache.getMatches((value) => value.id > 0);
    expect(matches).toHaveLength(0);
  });

  it('should return empty array for getMatches if no values match predicate', () => {
    const cache = new ExpiringEqualityCache<string, { id: number }>();
    cache.set('a', { id: 1 });
    cache.set('b', { id: 2 });
    const matches = cache.getMatches((value) => value.id > 5);
    expect(matches).toHaveLength(0);
  });
});
