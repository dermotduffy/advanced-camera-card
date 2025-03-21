import { expect, it } from 'vitest';
import { CASTING_PROFILE } from '../../../src/config/profiles/casting';
import { setProfiles } from '../../../src/config/profiles/set-profiles';
import { advancedCameraCardConfigSchema } from '../../../src/config/schema/types';
import { createRawConfig } from '../../test-utils';

it('should contain expected defaults', () => {
  expect(CASTING_PROFILE).toEqual({
    'cameras_global.image.refresh_seconds': 1,
    'dimensions.aspect_ratio_mode': 'static',
    'dimensions.aspect_ratio': '16:9',
    'live.auto_unmute': ['selected', 'visible'],
    'live.controls.builtin': false,
    'live.show_image_during_load': true,
    'media_viewer.controls.builtin': false,
    'menu.buttons.fullscreen.enabled': false,
    'menu.buttons.media_player.enabled': false,
    'menu.buttons.mute.enabled': true,
    'menu.buttons.play.enabled': true,
    'menu.style': 'none',
  });
});

it('should be parseable after application', () => {
  const rawInputConfig = createRawConfig();
  const parsedConfig = advancedCameraCardConfigSchema.parse(rawInputConfig);

  setProfiles(rawInputConfig, parsedConfig, ['casting']);

  // Reparse the config to ensure the profile did not introduce errors.
  const parseResult = advancedCameraCardConfigSchema.safeParse(parsedConfig);
  expect(parseResult.success, parseResult.error?.toString()).toBeTruthy();
});
