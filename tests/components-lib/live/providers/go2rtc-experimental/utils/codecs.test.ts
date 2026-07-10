import { describe, expect, it } from 'vitest';

import {
  convertToCodecString,
  getCodecsForUserAgent,
  GO2RTC_CODECS,
  selectSupportedCodecs,
} from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/codecs';
import { CHROME_USER_AGENT, SAFARI_17_USER_AGENT } from '../test-utils';

const safariUserAgent = (version: number): string =>
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  `(KHTML, like Gecko) Version/${version}.0 Safari/605.1.15`;

describe('getCodecsForUserAgent', () => {
  it('should return all codecs for non-Safari browsers', () => {
    expect(getCodecsForUserAgent(CHROME_USER_AGENT)).toEqual([...GO2RTC_CODECS]);
  });

  it('should exclude AAC and later for Safari before version 13', () => {
    expect(getCodecsForUserAgent(safariUserAgent(12))).toEqual([
      'avc1.640029',
      'avc1.64002A',
      'avc1.640033',
      'hvc1.1.6.L153.B0',
    ]);
  });

  it('should exclude FLAC and later for Safari before version 14', () => {
    expect(getCodecsForUserAgent(safariUserAgent(13))).toEqual([
      'avc1.640029',
      'avc1.64002A',
      'avc1.640033',
      'hvc1.1.6.L153.B0',
      'mp4a.40.2',
      'mp4a.40.5',
    ]);
  });

  it('should exclude OPUS for modern Safari', () => {
    expect(getCodecsForUserAgent(SAFARI_17_USER_AGENT)).toEqual([
      'avc1.640029',
      'avc1.64002A',
      'avc1.640033',
      'hvc1.1.6.L153.B0',
      'mp4a.40.2',
      'mp4a.40.5',
      'flac',
    ]);
  });
});

describe('selectSupportedCodecs', () => {
  it('should include all supported codecs for video and audio', () => {
    expect(
      selectSupportedCodecs(GO2RTC_CODECS, { audio: true, video: true }, () => true),
    ).toEqual([
      'avc1.640029',
      'avc1.64002A',
      'avc1.640033',
      'hvc1.1.6.L153.B0',
      'mp4a.40.2',
      'mp4a.40.5',
      'flac',
      'opus',
    ]);
  });

  it('should exclude audio codecs when audio is not requested', () => {
    expect(
      selectSupportedCodecs(GO2RTC_CODECS, { audio: false, video: true }, () => true),
    ).toEqual(['avc1.640029', 'avc1.64002A', 'avc1.640033', 'hvc1.1.6.L153.B0']);
  });

  it('should exclude video codecs when video is not requested', () => {
    expect(
      selectSupportedCodecs(GO2RTC_CODECS, { audio: true, video: false }, () => true),
    ).toEqual(['mp4a.40.2', 'mp4a.40.5', 'flac', 'opus']);
  });

  it('should exclude codecs the support callback rejects', () => {
    expect(
      selectSupportedCodecs(
        GO2RTC_CODECS,
        { audio: true, video: true },
        (mimeType) => mimeType === 'video/mp4; codecs="avc1.640029"',
      ),
    ).toEqual(['avc1.640029']);
  });
});

describe('convertToCodecString', () => {
  it('should join codecs with commas', () => {
    expect(convertToCodecString(['avc1.640029', 'mp4a.40.2'])).toBe(
      'avc1.640029,mp4a.40.2',
    );
  });

  it('should return an empty string for no codecs', () => {
    expect(convertToCodecString([])).toBe('');
  });
});
