import { CacheInterface } from './types.js';

export class CacheBase<Key, Value> implements CacheInterface<Key, Value> {
  private _cache: Map<Key, Value>;

  constructor(cache: Map<Key, Value>) {
    this._cache = cache;
  }

  /**
   * Determine if the cache has a given id.
   * @param key
   * @returns `true` if the id is in the cache, `false` otherwise.
   */
  public has(key: Key): boolean {
    return this._cache.has(key);
  }

  public entries(): MapIterator<[Key, Value]> {
    return this._cache.entries();
  }

  public delete(key: Key): boolean {
    return this._cache.delete(key);
  }

  public clear(): void {
    this._cache.clear();
  }

  /**
   * Get resolved media information given an id.
   * @param key The id.
   * @returns The `ResolvedMedia` for this id.
   */
  public get(key: Key): Value | null {
    return this._cache.get(key) ?? null;
  }

  public getMatches(predicate: (arg: Value) => boolean): Value[] {
    return [...this._cache.values()].filter(predicate);
  }

  /**
   * Add a given ResolvedMedia to the cache.
   * @param key The id for the object.
   * @param resolvedMedia The `ResolvedMedia` object.
   */
  public set(key: Key, val: Value): void {
    this._cache.set(key, val);
  }
}
