import QuickLRU from 'quick-lru';
import { CacheBase } from './base';

export class LRUCache<Key, Value> extends CacheBase<Key, Value> {
  constructor(maxSize: number) {
    super(new QuickLRU({ maxSize }));
  }
}
