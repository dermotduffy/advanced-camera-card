import { describe, expect, it } from 'vitest';
import { getConfigValue } from '../../../src/config/management';
import { SCRUBBING_PROFILE } from '../../../src/config/profiles/scrubbing';
import { setProfiles } from '../../../src/config/profiles/set-profiles';
import { advancedCameraCardConfigSchema } from '../../../src/config/schema/types';
import { createRawConfig } from '../../test-utils';

describe('SCRUBBING_PROFILE', () => {
  it('should contain expected defaults', () => {
    expect(SCRUBBING_PROFILE).toEqual({
      'live.controls.timeline.mode': 'below',
      'live.controls.timeline.style': 'ribbon',
      'live.controls.timeline.pan_mode': 'seek',
      'media_viewer.controls.timeline.mode': 'below',
      'media_viewer.controls.timeline.style': 'ribbon',
      'media_viewer.controls.timeline.pan_mode': 'seek',
    });
  });

  it('should apply each profile value to the merged config', () => {
    const rawInputConfig = createRawConfig();
    const parsedConfig = advancedCameraCardConfigSchema.parse(rawInputConfig);

    setProfiles(rawInputConfig, parsedConfig, ['scrubbing']);

    for (const [path, expected] of Object.entries(SCRUBBING_PROFILE)) {
      expect(getConfigValue(parsedConfig, path), path).toEqual(expected);
    }
  });

  it('should preserve user-specified values over profile values', () => {
    const rawInputConfig = createRawConfig({
      live: { controls: { timeline: { mode: 'none' } } },
    });
    const parsedConfig = advancedCameraCardConfigSchema.parse(rawInputConfig);

    setProfiles(rawInputConfig, parsedConfig, ['scrubbing']);

    expect(parsedConfig.live.controls.timeline.mode).toBe('none');

    // Non-overridden profile values should still be applied.
    expect(parsedConfig.live.controls.timeline.style).toBe('ribbon');
    expect(parsedConfig.media_viewer.controls.timeline.mode).toBe('below');
  });

  it('should be parseable after application', () => {
    const rawInputConfig = createRawConfig();
    const parsedConfig = advancedCameraCardConfigSchema.parse(rawInputConfig);

    setProfiles(rawInputConfig, parsedConfig, ['scrubbing']);

    const parseResult = advancedCameraCardConfigSchema.safeParse(parsedConfig);
    expect(parseResult.success, parseResult.error?.toString()).toBeTruthy();
  });
});
