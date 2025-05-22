import { describe, expect, it } from 'vitest';
import { Cache } from '../../src/cache/cache';

interface TestCacheValue {
  val: number;
}

describe('Cache', () => {
  describe('has', () => {
    it('positive', () => {
      const cache = new Cache<string, TestCacheValue>();
      cache.set('test', { val: 2 });
      expect(cache.has('test')).toBeTruthy();
    });

    it('negative', () => {
      const cache = new Cache<string, TestCacheValue>();
      expect(cache.has('absent')).toBeFalsy();
    });
  });

  describe('get', () => {
    it('positive', () => {
      const cache = new Cache<string, TestCacheValue>();
      cache.set('test', { val: 2 });
      expect(cache.get('test')).toEqual({ val: 2 });
    });

    it('negative', () => {
      const cache = new Cache<string, TestCacheValue>();
      expect(cache.get('absent')).toBeNull();
    });
  });

  it('delete', () => {
    const cache = new Cache<string, TestCacheValue>();
    cache.set('test-1', { val: 1 });
    cache.set('test-2', { val: 2 });
    cache.set('test-3', { val: 3 });

    cache.delete('test-2');

    expect(cache.get('test-2')).toBeNull();
    expect(cache.get('test-1')).toEqual({ val: 1 });
    expect(cache.get('test-3')).toEqual({ val: 3 });
  });

  it('clear', () => {
    const cache = new Cache<string, TestCacheValue>();
    cache.set('test-1', { val: 1 });
    cache.set('test-2', { val: 2 });
    cache.set('test-3', { val: 3 });

    cache.clear();

    expect(cache.get('test-1')).toBeNull();
    expect(cache.get('test-2')).toBeNull();
    expect(cache.get('test-3')).toBeNull();
  });

  it('getMatches', () => {
    const cache = new Cache<string, TestCacheValue>();
    cache.set('test-1', { val: 1 });
    cache.set('test-2', { val: 2 });
    cache.set('test-3', { val: 3 });

    expect(cache.getMatches((obj) => obj.val >= 2)).toEqual([{ val: 2 }, { val: 3 }]);
  });

  it('entries', () => {
    const cache = new Cache<string, TestCacheValue>();
    cache.set('test-1', { val: 1 });
    cache.set('test-2', { val: 2 });
    cache.set('test-3', { val: 3 });

    expect([...cache.entries()]).toEqual([
      ['test-1', { val: 1 }],
      ['test-2', { val: 2 }],
      ['test-3', { val: 3 }],
    ]);
  });
});
