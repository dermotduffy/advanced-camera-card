import { describe, expect, it } from 'vitest';
import { LRUCache } from '../../src/cache/lru';

interface TestCacheValue {
  val: number;
}

describe('LRUCache', () => {
  describe('has', () => {
    it('positive', () => {
      const cache = new LRUCache<string, TestCacheValue>(1);
      cache.set('test', { val: 2 });
      expect(cache.has('test')).toBeTruthy();
    });

    it('negative', () => {
      const cache = new LRUCache<string, TestCacheValue>(1);
      expect(cache.has('absent')).toBeFalsy();
    });
  });

  describe('get', () => {
    it('positive', () => {
      const cache = new LRUCache<string, TestCacheValue>(1);
      cache.set('test', { val: 2 });
      expect(cache.get('test')).toEqual({ val: 2 });
    });

    it('negative', () => {
      const cache = new LRUCache<string, TestCacheValue>(1);
      expect(cache.get('absent')).toBeNull();
    });
  });

  it('delete', () => {
    const cache = new LRUCache<string, TestCacheValue>(1);
    cache.set('test-1', { val: 1 });

    cache.delete('test-1');

    expect(cache.get('test-1')).toBeNull();
  });

  it('clear', () => {
    const cache = new LRUCache<string, TestCacheValue>(1);
    cache.set('test-1', { val: 1 });

    cache.clear();

    expect(cache.get('test-1')).toBeNull();
  });

  it('getMatches', () => {
    const cache = new LRUCache<string, TestCacheValue>(1);
    cache.set('test-1', { val: 1 });
    cache.set('test-2', { val: 2 });
    cache.set('test-3', { val: 3 });

    expect(cache.getMatches((obj) => obj.val >= 0)).toEqual([{ val: 3 }]);
  });

  it('entries', () => {
    const cache = new LRUCache<string, TestCacheValue>(1);
    cache.set('test-1', { val: 1 });
    cache.set('test-2', { val: 2 });
    cache.set('test-3', { val: 3 });

    expect([...cache.entries()]).toEqual([['test-3', { val: 3 }]]);
  });
});
