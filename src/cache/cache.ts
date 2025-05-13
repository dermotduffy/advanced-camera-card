import { CacheBase } from './base';

export class Cache<Key, Value> extends CacheBase<Key, Value> {
  constructor() {
    super(new Map());
  }
}
