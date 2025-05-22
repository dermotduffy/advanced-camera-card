import { CacheInterface } from './types';
import { EqualityCache } from './equality-cache';

interface ExpiringValue<Value> {
  value: Value;
  expires?: Date;
}

export class ExpiringEqualityCache<Key, Value> implements CacheInterface<Key, Value> {
  protected _data: EqualityCache<Key, ExpiringValue<Value>> = new EqualityCache();

  public get(key: Key): Value | null {
    const value = this._data.get(key);
    const now = new Date();
    return value && (!value.expires || now <= value.expires) ? value.value : null;
  }

  public has(key: Key): boolean {
    return !!this.get(key);
  }

  public set(key: Key, value: Value, expiry?: Date): void {
    this._data.set(key, {
      value: value,
      expires: expiry,
    });

    // Clean up old requests on set.
    this._expireOldValues();
  }

  public delete(key: Key): boolean {
    return this._data.delete(key);
  }

  public clear(): void {
    this._data.clear();
  }

  public *entries(): MapIterator<[Key, Value]> {
    const now = new Date();
    for (const [key, value] of this._data.entries()) {
      if (!value.expires || now <= value.expires) {
        yield [key, value.value];
      }
    }
  }

  public getMatches(predicate: (value: Value) => boolean): Value[] {
    const out: Value[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_key, value] of this.entries()) {
      if (predicate(value)) {
        out.push(value);
      }
    }
    return out;
  }

  protected _expireOldValues(): void {
    const now = new Date();

    for (const [key, value] of this._data.entries()) {
      if (value.expires && now > value.expires) {
        this._data.delete(key);
      }
    }
  }
}
