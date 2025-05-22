export interface CacheInterface<K, V> {
  has(k: K): boolean;
  get(k: K): V | null;
  set(k: K, v: V): void;
  delete(k: K): boolean;
  clear(): void;
  entries(): MapIterator<[K, V]>;
  getMatches(predicate: (arg: V) => boolean): V[];
}
