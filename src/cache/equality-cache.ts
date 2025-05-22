import { CacheBase } from './base';
import { EqualityMap } from './equality-map';

export class EqualityCache<Key, Value> extends CacheBase<Key, Value> {
  constructor() {
    super(new EqualityMap());
  }
}
