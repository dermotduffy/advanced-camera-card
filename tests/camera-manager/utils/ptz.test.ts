import { describe, expect, it } from 'vitest';
import {
  getConfiguredPTZAction,
  getConfiguredPTZMovementType,
  getPTZCapabilitiesFromCameraConfig,
} from '../../../src/camera-manager/utils/ptz';
import { PTZAction } from '../../../src/config/schema/actions/custom/ptz';
import { createCameraConfig } from '../../test-utils';

const action = {
  action: 'perform-action' as const,
  perform_action: 'action',
  data: {
    device: '048123',
    cmd: 'preset',
    preset: 'window',
  },
};

describe('getConfiguredPTZAction', () => {
  describe('should return preset', () => {
    it('with preset', () => {
      expect(
        getConfiguredPTZAction(
          createCameraConfig({
            ptz: {
              presets: {
                window: action,
              },
            },
          }),
          'preset',
          {
            preset: 'window',
          },
        ),
      ).toEqual(action);
    });

    it('without preset', () => {
      expect(
        getConfiguredPTZAction(
          createCameraConfig({
            ptz: {
              presets: {
                window: action,
              },
            },
          }),
          'preset',
        ),
      ).toBeNull();
    });
  });

  describe('should return continuous action', () => {
    it('with action', () => {
      expect(
        getConfiguredPTZAction(
          createCameraConfig({
            ptz: {
              actions_left_start: action,
            },
          }),
          'left',
          {
            phase: 'start',
          },
        ),
      ).toEqual(action);
    });

    it('without action', () => {
      expect(
        getConfiguredPTZAction(
          createCameraConfig({
            ptz: {},
          }),
          'left',
          {
            phase: 'start',
          },
        ),
      ).toBeNull();
    });
  });
});

describe('getConfiguredPTZMovementType', () => {
  it('with continuous', () => {
    expect(
      getConfiguredPTZMovementType(
        createCameraConfig({
          ptz: {
            actions_left_start: action,
            actions_left_stop: action,
          },
        }),
        'left',
      ),
    )?.toEqual(['continuous']);
  });

  it('with relative', () => {
    expect(
      getConfiguredPTZMovementType(
        createCameraConfig({
          ptz: {
            actions_left: action,
          },
        }),
        'left',
      ),
    )?.toEqual(['relative']);
  });

  it('with continuous and relative', () => {
    expect(
      getConfiguredPTZMovementType(
        createCameraConfig({
          ptz: {
            actions_left: action,
            actions_left_start: action,
            actions_left_stop: action,
          },
        }),
        'left',
      ),
    )?.toEqual(['continuous', 'relative']);
  });

  it('with no actions', () => {
    expect(
      getConfiguredPTZMovementType(
        createCameraConfig({
          ptz: {},
        }),
        'left',
      ),
    )?.toBeNull();
  });
});

describe('getPTZCapabilitiesFromCameraConfig', () => {
  it('with nothing', () => {
    expect(getPTZCapabilitiesFromCameraConfig(createCameraConfig()))?.toBeNull();
  });

  describe('with individual actions', () => {
    it.each([
      ['left' as const, 'left'],
      ['right' as const, 'right'],
      ['up' as const, 'up'],
      ['down' as const, 'down'],
      ['zoom_in' as const, 'zoomIn'],
      ['zoom_out' as const, 'zoomOut'],
    ])('%s', async (actionName: PTZAction, capabilityName: string) => {
      expect(
        getPTZCapabilitiesFromCameraConfig(
          createCameraConfig({
            ptz: {
              ['actions_' + actionName]: action,
            },
          }),
        ),
      )?.toEqual({
        [capabilityName]: ['relative'],
      });
    });
  });

  it('with preset', () => {
    expect(
      getPTZCapabilitiesFromCameraConfig(
        createCameraConfig({
          ptz: {
            presets: {
              window: action,
            },
          },
        }),
      ),
    )?.toEqual({
      presets: ['window'],
    });
  });
});
