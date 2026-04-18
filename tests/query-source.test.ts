import { describe, expect, it } from 'vitest';
import { hasUnsupportedFilters } from '../src/query-source';

describe('hasUnsupportedFilters', () => {
  it('should return false for empty query', () => {
    expect(hasUnsupportedFilters({})).toBeFalsy();
  });

  it('should return false when all filters are supported', () => {
    const result = hasUnsupportedFilters(
      {
        favorite: true,
        tags: new Set(['tag']),
        what: new Set(['person']),
        where: new Set(['yard']),
        reviewed: false,
        severity: new Set(['high' as const]),
      },
      {
        favorite: true,
        tags: true,
        what: true,
        where: true,
        reviewed: true,
        severity: true,
      },
    );
    expect(result).toBeFalsy();
  });

  describe('should detect unsupported filter', () => {
    it('favorite', () => {
      expect(hasUnsupportedFilters({ favorite: true })).toBeTruthy();
    });

    it('tags', () => {
      expect(hasUnsupportedFilters({ tags: new Set(['tag']) })).toBeTruthy();
    });

    it('what', () => {
      expect(hasUnsupportedFilters({ what: new Set(['person']) })).toBeTruthy();
    });

    it('where', () => {
      expect(hasUnsupportedFilters({ where: new Set(['yard']) })).toBeTruthy();
    });

    it('reviewed', () => {
      expect(hasUnsupportedFilters({ reviewed: false })).toBeTruthy();
    });

    it('severity', () => {
      expect(
        hasUnsupportedFilters({
          severity: new Set(['high' as const]),
        }),
      ).toBeTruthy();
    });
  });

  describe('should ignore empty sets', () => {
    it('tags', () => {
      expect(hasUnsupportedFilters({ tags: new Set() })).toBeFalsy();
    });

    it('what', () => {
      expect(hasUnsupportedFilters({ what: new Set() })).toBeFalsy();
    });

    it('where', () => {
      expect(hasUnsupportedFilters({ where: new Set() })).toBeFalsy();
    });

    it('severity', () => {
      expect(hasUnsupportedFilters({ severity: new Set() })).toBeFalsy();
    });
  });
});
