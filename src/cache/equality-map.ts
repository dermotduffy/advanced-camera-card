import { isEqual } from 'lodash-es';

interface EqualityMapItem<Key, Value> {
  key: Key;
  value: Value;
}

/** A simple equality based map. This is not performant and should be used for
 * small datasets only.
 */
export class EqualityMap<Key, Value> implements Map<Key, Value> {
  private _data: EqualityMapItem<Key, Value>[] = [];

  get [Symbol.toStringTag](): string {
    return 'EqualityMap';
  }

  public has(key: Key): boolean {
    return !!this.get(key);
  }

  public get(searchKey: Key): Value | undefined {
    for (const pair of this._data) {
      if (isEqual(pair.key, searchKey)) {
        return pair.value;
      }
    }
    return undefined;
  }

  public set(key: Key, value: Value): this {
    this.delete(key);
    this._data.push({ key, value });
    return this;
  }

  public delete(searchKey: Key): boolean {
    for (let i = 0; i < this._data.length; i++) {
      if (isEqual(this._data[i].key, searchKey)) {
        this._data.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  public clear(): void {
    this._data = [];
  }

  public *entries(): MapIterator<[Key, Value]> {
    for (const pair of this._data) {
      yield [pair.key, pair.value];
    }
  }

  public forEach(
    callbackfn: (value: Value, key: Key, map: Map<Key, Value>) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thisArg?: any,
  ): void {
    for (const pair of this._data) {
      callbackfn.call(thisArg, pair.value, pair.key, this);
    }
  }

  public get size(): number {
    return this._data.length;
  }

  public [Symbol.iterator](): IterableIterator<[Key, Value]> {
    return this.entries();
  }
  public keys(): IterableIterator<Key> {
    return this._data.map((pair) => pair.key).values();
  }
  public values(): IterableIterator<Value> {
    return this._data.map((pair) => pair.value).values();
  }
}
