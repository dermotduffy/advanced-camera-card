import { describe, expect, it } from 'vitest';
import {
  brandsUrl,
  extractDomainFromBrandUrl,
  isBrandUrl,
} from '../../src/ha/brands-url';

describe('brandsUrl', () => {
  it('generates a basic icon url', () => {
    expect(brandsUrl({ domain: 'amcrest', type: 'icon' })).toBe(
      'https://brands.home-assistant.io/amcrest/icon.png',
    );
  });

  it('generates a logo url with brand', () => {
    expect(brandsUrl({ domain: 'hikvision', type: 'logo', brand: true })).toBe(
      'https://brands.home-assistant.io/brands/hikvision/logo.png',
    );
  });

  it('generates a dark optimized icon@2x url with fallback', () => {
    expect(
      brandsUrl({
        domain: 'unifi',
        type: 'icon@2x',
        useFallback: true,
        darkOptimized: true,
      }),
    ).toBe('https://brands.home-assistant.io/_/unifi/dark_icon@2x.png');
  });

  it('generates a logo@2x url with all options', () => {
    expect(
      brandsUrl({
        domain: 'dahua',
        type: 'logo@2x',
        useFallback: true,
        darkOptimized: true,
        brand: true,
      }),
    ).toBe('https://brands.home-assistant.io/brands/_/dahua/dark_logo@2x.png');
  });
});

describe('extractDomainFromBrandUrl', () => {
  it('extracts domain from a brands url', () => {
    expect(
      extractDomainFromBrandUrl(
        'https://brands.home-assistant.io/brands/hikvision/logo.png',
      ),
    ).toBe('hikvision');
  });
});

describe('isBrandUrl', () => {
  it('returns true for a valid brands url', () => {
    expect(isBrandUrl('https://brands.home-assistant.io/amcrest/icon.png')).toBe(true);
  });

  it('returns false for a non-brands url', () => {
    expect(isBrandUrl('https://example.com/amcrest/icon.png')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isBrandUrl(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isBrandUrl(null)).toBe(false);
  });
});
