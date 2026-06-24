import { describe, expect, it } from 'vitest';

import { getCameraID } from '../../src/utils/camera.js';
import { createCameraConfig } from '../test-utils.js';

describe('getCameraID', () => {
  it('should get camera id with id', () => {
    const config = createCameraConfig({ id: 'foo' });
    expect(getCameraID(config)).toBe('foo');
  });
  it('should get camera id with camera_entity', () => {
    const config = createCameraConfig({ camera_entity: 'foo' });
    expect(getCameraID(config)).toBe('foo');
  });
  it('should get camera id with webrtc entity', () => {
    const config = createCameraConfig({ webrtc_card: { entity: 'foo' } });
    expect(getCameraID(config)).toBe('foo');
  });
  it('should get camera id with webrtc url', () => {
    const config = createCameraConfig({ webrtc_card: { url: 'foo' } });
    expect(getCameraID(config)).toBe('foo');
  });
  it('should get camera id with go2rtc url and stream', () => {
    const config = createCameraConfig({
      go2rtc: { url: 'https://foo', stream: 'office' },
    });
    expect(getCameraID(config)).toBe('https://foo#office');
  });
  it('should get camera id with frigate camera_name', () => {
    const config = createCameraConfig({
      frigate: { client_id: 'bar', camera_name: 'foo' },
    });
    expect(getCameraID(config)).toBe('foo');
  });
  it('should get blank id without anything', () => {
    const config = createCameraConfig({});
    expect(getCameraID(config)).toBe('');
  });
});
