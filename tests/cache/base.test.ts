import { describe, expect, it } from 'vitest';
import { CacheBase } from '../../src/cache/base';

describe('CacheBase', () => {
  describe('has', () => {
    it('should return true when key exists', () => {
      const cache = new CacheBase(new Map([['a', 1]]));
      expect(cache.has('a')).toBeTruthy();
    });

    it('should return false when key is absent', () => {
      const cache = new CacheBase<string, number>(new Map());
      expect(cache.has('a')).toBeFalsy();
    });
  });

  describe('get', () => {
    it('should return value when key exists', () => {
      const cache = new CacheBase(new Map([['a', 1]]));
      expect(cache.get('a')).toBe(1);
    });

    it('should return null when key is absent', () => {
      const cache = new CacheBase<string, number>(new Map());
      expect(cache.get('a')).toBeNull();
    });
  });

  it('should set a value', () => {
    const cache = new CacheBase<string, number>(new Map());
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('should delete a key', () => {
    const cache = new CacheBase(new Map([['a', 1]]));
    expect(cache.delete('a')).toBeTruthy();
    expect(cache.has('a')).toBeFalsy();
  });

  it('should clear all entries', () => {
    const cache = new CacheBase(
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
    );

    cache.clear();

    expect(cache.has('a')).toBeFalsy();
    expect(cache.has('b')).toBeFalsy();
  });

  it('should return matching entries', () => {
    const cache = new CacheBase(
      new Map([
        ['a', 1],
        ['b', 2],
        ['c', 3],
      ]),
    );
    expect(cache.getMatches((v) => v >= 2)).toEqual([2, 3]);
  });

  it('should iterate entries', () => {
    const cache = new CacheBase(
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
    );
    expect([...cache.entries()]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});
