import QuickLRU from 'quick-lru';

import { CacheBase } from './base';

export class LRUCache<Key, Value> extends CacheBase<Key, Value> {
  constructor(maxSize: number) {
    // quick-lru's declared iterators omit Symbol.dispose, so they no longer
    // match Map. The instance is still a Map at runtime.
    super(new QuickLRU<Key, Value>({ maxSize }) as unknown as Map<Key, Value>);
  }
}
