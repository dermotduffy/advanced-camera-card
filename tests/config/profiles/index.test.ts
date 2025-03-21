import { describe, expect, it } from 'vitest';
import { setProfiles } from '../../../src/config/profiles/set-profiles';
import { ProfileType } from '../../../src/config/schema/profiles';
import { createConfig } from '../../test-utils';

describe('setProfiles', () => {
  it('should handle failed parse', () => {
    expect(setProfiles({ cameras: 'not_an_array' }, {})).toEqual({});
  });

  it('should handle no profiles', () => {
    const input = createConfig();
    const output = createConfig();

    expect(setProfiles(input, output)).toEqual(input);
  });

  it('should handle invalid profiles', () => {
    const input = createConfig();
    const output = createConfig();

    expect(setProfiles(input, output, ['bogus' as ProfileType])).toEqual(input);
  });

  it('should handle profiles', () => {
    const input = {
      type: 'custom:advanced-camera-card',
      cameras: [{}],
      live: {
        controls: {
          timeline: {
            // This will not be overridden.
            style: 'stack',
          },
        },
      },
    };
    expect(setProfiles(input, {}, ['scrubbing'])).toEqual({
      live: {
        controls: {
          timeline: {
            mode: 'below',
            pan_mode: 'seek',
          },
        },
      },
      media_viewer: {
        controls: {
          timeline: {
            mode: 'below',
            style: 'ribbon',
            pan_mode: 'seek',
          },
        },
      },
    });
  });
});
