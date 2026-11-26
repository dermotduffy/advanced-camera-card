import { describe, expect, it } from 'vitest';

import { ZoomStore } from '../../src/utils/zoom-store';

describe('ZoomStore', () => {
  it('should keep a copy of a zoom per key', () => {
    const store = new ZoomStore();
    const zoom = { zoom: 2, pan: { x: 10, y: 20 } };
    store.set('a', zoom);
    zoom.pan.x = 99;

    expect(store.get('a')).toEqual({ zoom: 2, pan: { x: 10, y: 20 } });
    expect(store.get('b')).toBeNull();
  });

  it('should forget a zoom set to null', () => {
    const store = new ZoomStore();
    store.set('a', { zoom: 2, pan: { x: 10, y: 20 } });
    store.set('a', null);

    expect(store.get('a')).toBeNull();
  });

  it('should drop the zooms used least recently beyond its capacity', () => {
    const store = new ZoomStore();
    for (let i = 0; i < 100; i++) {
      store.set(`camera-${i}`, { zoom: 2, pan: { x: 10, y: 20 } });
    }

    expect(store.get('camera-0')).toBeNull();
    expect(store.get('camera-99')).toEqual({ zoom: 2, pan: { x: 10, y: 20 } });
  });

  it('should forget every zoom on clear', () => {
    const store = new ZoomStore();
    store.set('a', { zoom: 2, pan: { x: 10, y: 20 } });
    store.clear();

    expect(store.get('a')).toBeNull();
  });
});
