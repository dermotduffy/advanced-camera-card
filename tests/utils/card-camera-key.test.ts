import { describe, expect, it } from 'vitest';

import { encodeCardCameraKey } from '../../src/utils/card-camera-key';

describe('encodeCardCameraKey', () => {
  it('should give the same key for the same card and camera', () => {
    expect(encodeCardCameraKey({ cardID: 'card', cameraID: 'camera' })).toBe(
      encodeCardCameraKey({ cardID: 'card', cameraID: 'camera' }),
    );
    expect(encodeCardCameraKey({ cameraID: 'camera' })).toBe(
      encodeCardCameraKey({ cameraID: 'camera' }),
    );
  });

  it('should differ for another card or camera', () => {
    const key = encodeCardCameraKey({ cardID: 'card', cameraID: 'camera' });
    expect(encodeCardCameraKey({ cardID: 'other', cameraID: 'camera' })).not.toBe(key);
    expect(encodeCardCameraKey({ cameraID: 'camera' })).not.toBe(key);
    expect(encodeCardCameraKey({ cardID: 'card', cameraID: 'other' })).not.toBe(key);
  });
});
