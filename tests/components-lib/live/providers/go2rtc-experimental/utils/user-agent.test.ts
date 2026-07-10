import { describe, expect, it } from 'vitest';

import {
  getSafariMajorVersion,
  isWebKitUserAgent,
} from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/user-agent';

describe('isWebKitUserAgent', () => {
  it.each([
    [
      'Safari on macOS',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      true,
    ],
    [
      'Safari on iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      true,
    ],
    [
      'iOS WebView without a Safari token',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Mobile/21A329',
      true,
    ],
    [
      'Chrome on iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
      true,
    ],
    [
      'Firefox on iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15',
      true,
    ],
    [
      'Chrome on Linux',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      false,
    ],
    [
      'Chrome on Android',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
      false,
    ],
    [
      'Edge on Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
      false,
    ],
    [
      'Firefox on Linux',
      'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
      false,
    ],
  ])('should detect %s', (_name: string, userAgent: string, expected: boolean) => {
    expect(isWebKitUserAgent(userAgent)).toBe(expected);
  });
});

describe('getSafariMajorVersion', () => {
  it('should return the major version for Safari', () => {
    expect(
      getSafariMajorVersion(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
          '(KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      ),
    ).toBe(17);
  });

  it('should return null for a non-Safari user agent', () => {
    expect(
      getSafariMajorVersion(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      ),
    ).toBe(null);
  });
});
