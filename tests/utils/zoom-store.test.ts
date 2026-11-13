import { describe, expect, it } from 'vitest';

import { getZoomKey, ZoomStore } from '../../src/utils/zoom-store';

describe('getZoomKey', () => {
  it('should give the same key for the same card and camera', () => {
    expect(getZoomKey({ cardID: 'card', cameraID: 'camera' })).toBe(
      getZoomKey({ cardID: 'card', cameraID: 'camera' }),
    );
    expect(getZoomKey({ cameraID: 'camera' })).toBe(getZoomKey({ cameraID: 'camera' }));
  });

  it('should differ for another card or camera', () => {
    const key = getZoomKey({ cardID: 'card', cameraID: 'camera' });
    expect(getZoomKey({ cardID: 'other', cameraID: 'camera' })).not.toBe(key);
    expect(getZoomKey({ cameraID: 'camera' })).not.toBe(key);
    expect(getZoomKey({ cardID: 'card', cameraID: 'other' })).not.toBe(key);
  });
});

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

  it('should forget every zoom on clear', () => {
    const store = new ZoomStore();
    store.set('a', { zoom: 2, pan: { x: 10, y: 20 } });
    store.clear();

    expect(store.get('a')).toBeNull();
  });
});
