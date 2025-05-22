import { describe, expect, it } from 'vitest';
import { EqualityMap } from '../../src/cache/equality-map';

describe('EqualityMap', () => {
  it('should set and get values with primitive keys', () => {
    const map = new EqualityMap<string, number>();
    map.set('a', 1);
    expect(map.get('a')).toBe(1);
    expect(map.has('a')).toBe(true);
    expect(map.get('b')).toBeUndefined();
    expect(map.has('b')).toBe(false);
  });

  it('should set and get values with object keys using deep equality', () => {
    const map = new EqualityMap<{ x: number }, string>();
    map.set({ x: 1 }, 'foo');
    expect(map.get({ x: 1 })).toBe('foo');
    expect(map.has({ x: 1 })).toBe(true);
    expect(map.get({ x: 2 })).toBeUndefined();
  });

  it('should overwrite value if key is deeply equal', () => {
    const map = new EqualityMap<{ y: number }, string>();
    map.set({ y: 2 }, 'bar');
    map.set({ y: 2 }, 'baz');
    expect(map.get({ y: 2 })).toBe('baz');
    expect(map.size).toBe(1);
  });

  it('should delete values by deep equality', () => {
    const map = new EqualityMap<{ z: number }, string>();
    map.set({ z: 3 }, 'val');
    expect(map.delete({ z: 3 })).toBe(true);
    expect(map.get({ z: 3 })).toBeUndefined();
    expect(map.size).toBe(0);
  });

  it('should clear all values', () => {
    const map = new EqualityMap<number, string>();
    map.set(1, 'a');
    map.set(2, 'b');
    map.clear();
    expect(map.size).toBe(0);
    expect(map.get(1)).toBeUndefined();
    expect(map.get(2)).toBeUndefined();
  });

  it('should iterate entries', () => {
    const map = new EqualityMap<string, number>();
    map.set('a', 1);
    map.set('b', 2);
    const entries = Array.from(map);
    expect(entries).toContainEqual(['a', 1]);
    expect(entries).toContainEqual(['b', 2]);
  });

  it('should iterate keys', () => {
    const map = new EqualityMap<string, number>();
    map.set('x', 10);
    map.set('y', 20);
    const keys = Array.from(map.keys());
    expect(keys).toContain('x');
    expect(keys).toContain('y');
  });

  it('should iterate values', () => {
    const map = new EqualityMap<string, number>();
    map.set('foo', 100);
    map.set('bar', 200);
    const values = Array.from(map.values());
    expect(values).toContain(100);
    expect(values).toContain(200);
  });

  it('should call forEach with correct arguments', () => {
    const map = new EqualityMap<string, number>();
    map.set('a', 1);
    map.set('b', 2);
    const calls: [number, string][] = [];
    map.forEach((value, key) => {
      calls.push([value, key]);
    });
    expect(calls).toContainEqual([1, 'a']);
    expect(calls).toContainEqual([2, 'b']);
  });

  it('should have correct Symbol.toStringTag', () => {
    const map = new EqualityMap<number, number>();
    expect(Object.prototype.toString.call(map)).toBe('[object EqualityMap]');
  });
});
