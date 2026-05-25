import { expect, it } from 'vitest';
import { DOORBELL_PROFILE } from '../../../src/config/profiles/doorbell';
import { setProfiles } from '../../../src/config/profiles/set-profiles';
import { advancedCameraCardConfigSchema } from '../../../src/config/schema/types';
import { createRawConfig } from '../../test-utils';

it('should contain expected defaults', () => {
  expect(DOORBELL_PROFILE).toEqual({
    'cameras_global.triggers.doorbell': true,
    'view.triggers.actions.interaction_mode': 'all',
    'view.triggers.actions.trigger': 'call',
    'view.triggers.actions.untrigger': 'call',
    'view.triggers.show_trigger_status': true,
  });
});

it('should be parseable after application', () => {
  const rawInputConfig = createRawConfig();
  const parsedConfig = advancedCameraCardConfigSchema.parse(rawInputConfig);

  setProfiles(rawInputConfig, parsedConfig, ['doorbell']);

  // Reparse the config to ensure the profile did not introduce errors.
  const parseResult = advancedCameraCardConfigSchema.safeParse(parsedConfig);
  expect(parseResult.success, parseResult.error?.toString()).toBeTruthy();
});
