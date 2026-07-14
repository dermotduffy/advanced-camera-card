import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as go2rtcAudio from '../../src/camera-manager/utils/go2rtc/audio';
import {
  getResolvedLiveProvider,
  isGo2RTCLiveProvider,
  liveProviderSupports2WayAudio,
} from '../../src/utils/live-provider';
import { createCameraConfig, createHASS } from '../test-utils';

vi.mock('../../src/camera-manager/utils/go2rtc/audio');

describe('live-provider utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getResolvedLiveProvider', () => {
    it('should resolve webrtc-card with entity', () => {
      const config = createCameraConfig({
        live_provider: 'auto',
        webrtc_card: { entity: 'camera.test' },
      });
      expect(getResolvedLiveProvider(config)).toBe('webrtc-card');
    });

    it('should resolve webrtc-card with url', () => {
      const config = createCameraConfig({
        live_provider: 'auto',
        webrtc_card: { url: 'http://test' },
      });
      expect(getResolvedLiveProvider(config)).toBe('webrtc-card');
    });

    it('should resolve ha', () => {
      const config = createCameraConfig({
        live_provider: 'auto',
        camera_entity: 'camera.test',
      });
      expect(getResolvedLiveProvider(config)).toBe('ha');
    });

    it('should resolve jsmpeg', () => {
      const config = createCameraConfig({
        live_provider: 'auto',
        frigate: { camera_name: 'test' },
      });
      expect(getResolvedLiveProvider(config)).toBe('jsmpeg');
    });

    it('should resolve image by default for auto', () => {
      const config = createCameraConfig({
        live_provider: 'auto',
      });
      expect(getResolvedLiveProvider(config)).toBe('image');
    });

    it('should return explicitly configured provider', () => {
      const config = createCameraConfig({
        live_provider: 'go2rtc',
      });
      expect(getResolvedLiveProvider(config)).toBe('go2rtc');
    });

    it('should return image if config is undefined', () => {
      expect(getResolvedLiveProvider(undefined)).toBe('image');
    });
  });

  describe('isGo2RTCLiveProvider', () => {
    it('should return true for go2rtc', () => {
      expect(isGo2RTCLiveProvider('go2rtc')).toBe(true);
    });

    it('should return true for go2rtc-experimental', () => {
      expect(isGo2RTCLiveProvider('go2rtc-experimental')).toBe(true);
    });

    it('should return false for other providers', () => {
      expect(isGo2RTCLiveProvider('ha')).toBe(false);
    });
  });

  describe('liveProviderSupports2WayAudio', () => {
    it('should return false if resolved provider is not go2rtc', async () => {
      const config = createCameraConfig({
        live_provider: 'ha',
      });
      const hass = createHASS();
      const result = await liveProviderSupports2WayAudio(
        hass,
        config,
        config.go2rtc.metadata_fetch_timeout_seconds,
      );
      expect(result).toBe(false);
    });

    it('should return result from go2rtcSupports2WayAudio', async () => {
      const config = createCameraConfig({
        live_provider: 'go2rtc',
      });
      const hass = createHASS();
      vi.mocked(go2rtcAudio.supports2WayAudio).mockResolvedValue(true);

      const result = await liveProviderSupports2WayAudio(
        hass,
        config,
        config.go2rtc.metadata_fetch_timeout_seconds,
      );
      expect(result).toBe(true);
      expect(go2rtcAudio.supports2WayAudio).toHaveBeenCalledWith(
        hass,
        2,
        undefined,
        undefined,
      );
    });

    it('should support 2-way audio for the experimental provider', async () => {
      const config = createCameraConfig({
        live_provider: 'go2rtc-experimental',
      });
      const hass = createHASS();
      vi.mocked(go2rtcAudio.supports2WayAudio).mockResolvedValue(true);

      const result = await liveProviderSupports2WayAudio(
        hass,
        config,
        config.go2rtc.metadata_fetch_timeout_seconds,
      );
      expect(result).toBe(true);
    });

    it('should pass metadata fetch timeout through to go2rtc detection', async () => {
      const config = createCameraConfig({
        live_provider: 'go2rtc',
      });
      const hass = createHASS();
      vi.mocked(go2rtcAudio.supports2WayAudio).mockResolvedValue(true);

      await liveProviderSupports2WayAudio(hass, config, 30);

      expect(go2rtcAudio.supports2WayAudio).toHaveBeenCalledWith(
        hass,
        30,
        undefined,
        undefined,
      );
    });
  });
});
