import { describe, expect, it } from 'vitest';
import {
  getGo2RTCMetadataEndpoint,
  getGo2RTCStreamEndpoint,
} from '../../../src/camera-manager/utils/go2rtc/endpoint.js';
import { createCameraConfig } from '../../test-utils.js';

describe('getGo2RTCStreamEndpoint', () => {
  it('with local configuration', () => {
    expect(
      getGo2RTCStreamEndpoint(
        createCameraConfig({
          go2rtc: {
            stream: 'stream',
            url: '/local/path',
          },
        }),
      ),
    ).toEqual({
      endpoint: '/local/path/api/ws?src=stream',
      sign: true,
    });
  });

  it('with remote configuration', () => {
    expect(
      getGo2RTCStreamEndpoint(
        createCameraConfig({
          go2rtc: {
            stream: 'stream',
            url: 'https://my-custom-go2rtc',
          },
        }),
      ),
    ).toEqual({
      endpoint: 'https://my-custom-go2rtc/api/ws?src=stream',
      sign: false,
    });
  });

  it('without configuration', () => {
    expect(getGo2RTCStreamEndpoint(createCameraConfig())).toBeNull();
  });
});

describe('getGo2RTCMetadataEndpoint', () => {
  it('with local configuration', () => {
    expect(
      getGo2RTCMetadataEndpoint(
        createCameraConfig({
          go2rtc: {
            stream: 'stream',
            url: '/local/path',
          },
        }),
      ),
    ).toEqual({
      endpoint: '/local/path/api/streams?src=stream&video=all&audio=all&microphone',
      sign: true,
    });
  });

  it('with remote configuration', () => {
    expect(
      getGo2RTCMetadataEndpoint(
        createCameraConfig({
          go2rtc: {
            stream: 'stream',
            url: 'https://my-custom-go2rtc',
          },
        }),
      ),
    ).toEqual({
      endpoint:
        'https://my-custom-go2rtc/api/streams?src=stream&video=all&audio=all&microphone',
      sign: false,
    });
  });

  it('without configuration', () => {
    expect(getGo2RTCMetadataEndpoint(createCameraConfig())).toBeNull();
  });
});
