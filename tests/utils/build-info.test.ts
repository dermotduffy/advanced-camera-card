import { describe, expect, it } from 'vitest';

import {
  getGitInfo,
  getReleaseVersion,
  getUnreleasedBuildDate,
} from '../../src/utils/build-info';

// As these are running as tests, the won't be build substitutes so this only
// tests default/fallback values.

describe('getReleaseVersion', () => {
  it('should report an unbuilt card as a development one', () => {
    expect(getReleaseVersion()).toBe('dev');
  });
});

describe('getGitInfo', () => {
  it('should report nothing about an unbuilt card', () => {
    expect(getGitInfo()).toEqual({});
  });
});

describe('getUnreleasedBuildDate', () => {
  it('should report no build date for an unbuilt card', () => {
    expect(getUnreleasedBuildDate()).toBeNull();
  });
});
