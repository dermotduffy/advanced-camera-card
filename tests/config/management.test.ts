import { describe, expect, it } from 'vitest';
import {
  copyConfig,
  createRangedTransform,
  deleteConfigValue,
  deleteTransform,
  deleteWithOverrides,
  getArrayConfigPath,
  getConfigValue,
  isConfigUpgradeable,
  moveConfigValue,
  setConfigValue,
  upgradeArrayOfObjects,
  upgradeConfig,
  upgradeMoveTo,
  upgradeMoveToWithOverrides,
  upgradeObjectRecursively,
  upgradeWithOverrides,
} from '../../src/config/management.js';
import { PTZControlAction } from '../../src/config/schema/actions/custom/ptz.js';
import { CallServiceActionConfig } from '../../src/config/schema/actions/stock/call-service.js';
import { PerformActionActionConfig } from '../../src/config/schema/actions/stock/perform-action.js';
import { Actions } from '../../src/config/schema/actions/types.js';
import { advancedCameraCardConfigSchema } from '../../src/config/schema/types.js';
import { RawAdvancedCameraCardConfig } from '../../src/config/types.js';
import { getParseErrorPaths } from '../../src/utils/zod/parse-errors.js';

describe('general functions', () => {
  it('should set value', () => {
    const target = {};
    setConfigValue(target, 'a', 10);
    expect(target).toEqual({
      a: 10,
    });
  });

  describe('should get value', () => {
    it('should get a present value', () => {
      expect(getConfigValue({ b: 11 }, 'b')).toEqual(11);
    });
    it('should return undefined for an absent value', () => {
      expect(getConfigValue({ b: 11 }, 'c')).toBeUndefined();
    });
    it('should return the default for an absent value', () => {
      expect(getConfigValue({ b: 11 }, 'c', 12)).toBe(12);
    });
  });

  describe('should unset value', () => {
    it('should unset a nested value', () => {
      const target = {
        moo: {
          foo: {
            a: 10,
          },
          bar: {
            b: 11,
          },
        },
      };
      deleteConfigValue(target, 'moo.foo');
      expect(target).toEqual({ moo: { bar: { b: 11 } } });
    });

    it('should unset a top-level value', () => {
      const target = {
        a: 10,
        b: 11,
      };
      deleteConfigValue(target, 'a');
      expect(target).toEqual({ b: 11 });
    });
  });

  it('should copy config', () => {
    const target = {
      a: {
        b: {
          c: 10,
        },
      },
    };
    const copy = copyConfig(target);

    expect(copy).toEqual(target);
    expect(copy).not.toBe(target);
  });

  it('should get array config path', () => {
    expect(getArrayConfigPath('a.#.b', 10)).toBe('a.[10].b');
  });
});

describe('upgrade functions', () => {
  it('should determine if config is upgradeable', () => {
    expect(
      // Upgrade example: rename of service_data to data.
      isConfigUpgradeable({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:cow',
            style: {
              right: '20px',
              top: '20px',
              color: 'white',
            },
            tap_action: {
              action: 'call-service',
              service: 'notify.persistent_notification',
              service_data: {
                message: 'Hello 1',
              },
            },
          },
        ],
      }),
    ).toBeTruthy();
  });

  describe('should create ranged transform', () => {
    describe('with numbers', () => {
      it('should keep a value inside the range', () => {
        expect(createRangedTransform((val) => val, 10, 20)(11)).toBe(11);
      });
      it('should clamp a value outside the range', () => {
        expect(createRangedTransform((val) => val, 10, 20)(1)).toBe(10);
      });
      it('should pass a value through with no range bounds', () => {
        expect(createRangedTransform((val) => val)(100)).toBe(100);
      });
    });
    it('should pass a non-number through', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      expect(createRangedTransform((_val) => 'foo')(1)).toBe('foo');
    });
  });

  it('should return null from delete property transform', () => {
    expect(deleteTransform(10)).toBeNull();
  });

  describe('should move config value', () => {
    it('should move a value', () => {
      const config = {
        foo: {
          c: 10,
        },
      };
      expect(moveConfigValue(config, 'foo', 'bar')).toBeTruthy();
      expect(config).toEqual({
        bar: {
          c: 10,
        },
      });
    });

    describe('in place', () => {
      it('should not modify a non-transformed in-place value', () => {
        const config = {
          foo: {
            c: 10,
          },
        };
        expect(moveConfigValue(config, 'foo', 'foo')).toBeFalsy();
        expect(config).toEqual({
          foo: {
            c: 10,
          },
        });
      });

      it('should transform an in-place value', () => {
        const config = {
          foo: {
            c: 10,
          },
        };
        expect(
          moveConfigValue(config, 'foo.c', 'foo.c', { transform: (val) => String(val) }),
        ).toBeTruthy();
        expect(config).toEqual({
          foo: {
            c: '10',
          },
        });
      });
    });

    describe('with transform result', () => {
      it('should move with a transform result', () => {
        const config = {
          c: 10,
        };
        expect(
          moveConfigValue(config, 'c', 'd', { transform: (val) => String(val) }),
        ).toBeTruthy();
        expect(config).toEqual({ d: '10' });
      });

      it('should keep the original with a transform result', () => {
        const config = {
          c: 10,
        };
        expect(
          moveConfigValue(config, 'c', 'd', {
            transform: (val) => String(val),
            keepOriginal: true,
          }),
        ).toBeTruthy();
        expect(config).toEqual({ c: 10, d: '10' });
      });
    });

    describe('with transform null result', () => {
      it('should remove on a null transform result', () => {
        const config = {
          c: 10,
        };
        expect(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          moveConfigValue(config, 'c', 'd', { transform: (_val) => null }),
        ).toBeTruthy();
        expect(config).toEqual({});
      });

      it('should keep the original on a null transform result', () => {
        const config = {
          c: 10,
        };
        expect(
          moveConfigValue(config, 'c', 'd', {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            transform: (_val) => null,
            keepOriginal: true,
          }),
        ).toBeFalsy();
        expect(config).toEqual({ c: 10 });
      });
    });

    it('should not modify on an undefined transform result', () => {
      const config = {
        c: 10,
      };
      expect(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        moveConfigValue(config, 'c', 'd', { transform: (_val) => undefined }),
      ).toBeFalsy();
      expect(config).toEqual({ c: 10 });
    });
  });

  it('should upgrade with a move', () => {
    const config = {
      c: 10,
    };

    expect(upgradeMoveTo('c', 'd')(config)).toBeTruthy();
    expect(config).toEqual({ d: 10 });
  });

  it('should upgrade config and overrides with a move', () => {
    const config = {
      c: 10,
      overrides: [
        {
          merge: {
            c: 10,
          },
          set: {
            c: 10,
          },
        },
      ],
    };

    expect(upgradeMoveToWithOverrides('c', 'd')(config)).toBeTruthy();
    expect(config).toEqual({ d: 10, overrides: [{ merge: { d: 10 }, set: { d: 10 } }] });
  });

  it('should upgrade config and overrides in-place', () => {
    const config = {
      c: 10,
      overrides: [
        {
          merge: {
            c: 10,
          },
        },
      ],
    };

    expect(upgradeWithOverrides('c', (val) => String(val))(config)).toBeTruthy();
    expect(config).toEqual({ c: '10', overrides: [{ merge: { c: '10' } }] });
  });

  describe('should upgrade array', () => {
    it('should handle a non-array', () => {
      const config = { c: 10 };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      expect(upgradeArrayOfObjects('c', (_val) => false)(config)).toBeFalsy();
    });

    it('should handle non-object items', () => {
      const config = { c: [10, 11] };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      expect(upgradeArrayOfObjects('c', (_val) => false)(config)).toBeFalsy();
    });

    it('should upgrade each object in an array', () => {
      const config = { c: [{ d: 10 }, { d: 11 }] };
      expect(
        upgradeArrayOfObjects('c', (val) => {
          val['e'] = 12;
          return true;
        })(config),
      ).toBeTruthy();
      expect(config).toEqual({
        c: [
          {
            d: 10,
            e: 12,
          },
          {
            d: 11,
            e: 12,
          },
        ],
      });
    });
  });

  describe('should recursively upgrade', () => {
    it('should ignore simple objects', () => {
      const config = { c: 10, d: 10 };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      expect(upgradeObjectRecursively((_val) => false)(config)).toBeFalsy();
      expect(config).toEqual({ c: 10, d: 10 });
    });

    it('should get sub-objects', () => {
      const config = { c: 10, target_obj: { target_val: 10 } };
      expect(
        upgradeObjectRecursively(
          (val: RawAdvancedCameraCardConfig) => {
            (val['target_val'] as number)++;
            return true;
          },
          (obj) => obj['target_obj'] as RawAdvancedCameraCardConfig,
        )(config),
      ).toBeTruthy();
      expect(config).toEqual({ c: 10, target_obj: { target_val: 11 } });
    });

    it('should iterate into arrays', () => {
      const config = { values: [{ c: 10 }, { d: 10 }, 'random'] };
      expect(
        upgradeObjectRecursively((val) => {
          if (!Array.isArray(val)) {
            val['e'] = 11;
          }
          return true;
        })(config),
      ).toBeTruthy();

      expect(config).toEqual({
        e: 11,
        values: [{ c: 10, e: 11 }, { d: 10, e: 11 }, 'random'],
      });
    });
  });

  it('should have upgrades with bad input data', () => {
    expect(upgradeConfig(3 as unknown as RawAdvancedCameraCardConfig)).toBeFalsy();
  });

  it('should delete properties', () => {
    const config = { c: 10, d: 10 };
    expect(deleteWithOverrides('c')(config)).toBeTruthy();
    expect(config).toEqual({ d: 10 });
  });
});

describe('should handle version specific upgrades', () => {
  const postUpgradeChecks = (config: RawAdvancedCameraCardConfig): void => {
    // Should be no additional upgrades.
    expect(upgradeConfig(config)).toBeFalsy();

    // Result should be parseable.
    const result = advancedCameraCardConfigSchema.safeParse(config);
    if (!result.success) {
      expect(
        result.success,
        'Post-upgrade parse error.\n\n' +
          'Problem paths: ' +
          [...getParseErrorPaths(result.error)] +
          '\n\n' +
          JSON.stringify(config, null, 2),
      ).toBeTruthy();
    }
  };

  describe('v5.2.0 -> v6.0.0', () => {
    describe('should rename service_data -> data', () => {
      it('should rename service_data -> data', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'icon',
              icon: 'mdi:cow',
              style: {
                right: '20px',
                top: '20px',
                color: 'white',
              },
              tap_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                service_data: {
                  message: 'Hello 1',
                },
              },
            },
            {
              type: 'service-button',
              title: 'title',
              service: 'service',
              service_data: {
                message: "It's a trick",
              },
            },
          ],
          view: {
            actions: {
              double_tap_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                service_data: {
                  message: 'Hello 2',
                },
              },
              hold_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                data: {
                  message: 'Hello 3',
                },
              },
            },
          },
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'icon',
              icon: 'mdi:cow',
              style: {
                right: '20px',
                top: '20px',
                color: 'white',
              },
              tap_action: {
                action: 'perform-action',
                perform_action: 'notify.persistent_notification',
                data: {
                  message: 'Hello 1',
                },
              },
            },
            {
              type: 'service-button',
              title: 'title',
              service: 'service',
              // Trick: This *is* still called service_data in HA, so should not
              // be modified.
              service_data: {
                message: "It's a trick",
              },
            },
          ],
          view: {
            actions: {
              double_tap_action: {
                action: 'perform-action',
                perform_action: 'notify.persistent_notification',
                data: {
                  message: 'Hello 2',
                },
              },
              hold_action: {
                action: 'perform-action',
                perform_action: 'notify.persistent_notification',
                data: {
                  message: 'Hello 3',
                },
              },
            },
          },
        });
        postUpgradeChecks(config);
      });
      it('should not change a config with nothing to rename', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          view: {
            default: 'live',
          },
        };
        expect(upgradeConfig(config)).toBeFalsy();
        expect(config).toEqual({
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          view: {
            default: 'live',
          },
        });
        postUpgradeChecks(config);
      });
    });

    describe('should move PTZ elements to live', () => {
      it('should move a single PTZ element to live', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'custom:advanced-camera-card-ptz',
              orientation: 'vertical',
              style: {
                right: '20px',
                top: '20px',
                color: 'white',
              },
              actions_up: {
                tap_action: {
                  action: 'call-service',
                  service: 'notify.persistent_notification',
                  service_data: {
                    message: 'Hello 1',
                  },
                },
              },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          cameras: [{ camera_entity: 'camera.office' }],
          cameras_global: {
            ptz: {
              actions_up: {
                action: 'perform-action',
                data: {
                  message: 'Hello 1',
                },
                perform_action: 'notify.persistent_notification',
              },
            },
          },
          live: {
            controls: {
              ptz: {
                orientation: 'vertical',
                style: {
                  color: 'white',
                  right: '20px',
                  top: '20px',
                },
              },
            },
          },
          type: 'custom:advanced-camera-card',
        });
        postUpgradeChecks(config);
      });

      it('should move a PTZ element to live and keep other elements', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'custom:advanced-camera-card-ptz',
              orientation: 'vertical',
              style: {
                right: '20px',
                top: '20px',
                color: 'white',
              },
              actions_up: {
                tap_action: {
                  action: 'call-service',
                  service: 'notify.persistent_notification',
                  service_data: {
                    message: 'Hello 1',
                  },
                },
              },
            },
            {
              type: 'service-button',
              title: 'title',
              service: 'service',
              service_data: {
                message: "It's a trick",
              },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          cameras: [{ camera_entity: 'camera.office' }],
          cameras_global: {
            ptz: {
              actions_up: {
                action: 'perform-action',
                data: {
                  message: 'Hello 1',
                },
                perform_action: 'notify.persistent_notification',
              },
            },
          },
          elements: [
            {
              service: 'service',
              service_data: {
                message: "It's a trick",
              },
              title: 'title',
              type: 'service-button',
            },
          ],
          live: {
            controls: {
              ptz: {
                orientation: 'vertical',
                style: {
                  color: 'white',
                  right: '20px',
                  top: '20px',
                },
              },
            },
          },
          type: 'custom:advanced-camera-card',
        });
        postUpgradeChecks(config);
      });

      it('should move PTZ from a custom conditional element with nothing else remaining', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'custom:advanced-camera-card-conditional',
              conditions: {
                fullscreen: true,
                media_loaded: true,
              },
              elements: [
                {
                  type: 'custom:advanced-camera-card-ptz',
                  orientation: 'vertical',
                  style: {
                    right: '20px',
                    top: '20px',
                    color: 'white',
                  },
                  actions_up: {
                    tap_action: {
                      action: 'call-service',
                      service: 'notify.persistent_notification',
                      service_data: {
                        message: 'Hello 1',
                      },
                    },
                  },
                },
                {
                  type: 'custom:advanced-camera-card-ptz',
                  orientation: 'vertical',
                  style: {
                    right: '20px',
                    top: '20px',
                    color: 'white',
                  },
                  actions_up: {
                    tap_action: {
                      action: 'call-service',
                      service: 'notify.persistent_notification',
                      service_data: {
                        message: 'Hello 2',
                      },
                    },
                  },
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          cameras: [{ camera_entity: 'camera.office' }],
          cameras_global: {
            ptz: {
              actions_up: {
                action: 'perform-action',
                data: {
                  message: 'Hello 1',
                },
                perform_action: 'notify.persistent_notification',
              },
            },
          },
          live: {
            controls: {
              ptz: {
                orientation: 'vertical',
                style: {
                  color: 'white',
                  right: '20px',
                  top: '20px',
                },
              },
            },
          },
          type: 'custom:advanced-camera-card',
        });
        postUpgradeChecks(config);
      });

      it('should move PTZ from a custom conditional element keeping the other element', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'custom:advanced-camera-card-conditional',
              conditions: {
                fullscreen: true,
                media_loaded: true,
              },
              elements: [
                {
                  type: 'service-button',
                  title: 'title',
                  service: 'service',
                  service_data: {
                    message: "It's a trick",
                  },
                },
                {
                  type: 'custom:advanced-camera-card-ptz',
                  orientation: 'vertical',
                  style: {
                    right: '20px',
                    top: '20px',
                    color: 'white',
                  },
                  actions_up: {
                    tap_action: {
                      action: 'call-service',
                      service: 'notify.persistent_notification',
                      service_data: {
                        message: 'Hello 1',
                      },
                    },
                  },
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          cameras: [{ camera_entity: 'camera.office' }],
          cameras_global: {
            ptz: {
              actions_up: {
                action: 'perform-action',
                data: {
                  message: 'Hello 1',
                },
                perform_action: 'notify.persistent_notification',
              },
            },
          },
          live: {
            controls: {
              ptz: {
                orientation: 'vertical',
                style: {
                  color: 'white',
                  right: '20px',
                  top: '20px',
                },
              },
            },
          },
          elements: [
            {
              type: 'custom:advanced-camera-card-conditional',
              conditions: [
                {
                  condition: 'fullscreen' as const,
                  fullscreen: true,
                },
                {
                  condition: 'media_loaded' as const,
                  media_loaded: true,
                },
              ],
              elements: [
                {
                  type: 'service-button',
                  title: 'title',
                  service: 'service',
                  service_data: {
                    message: "It's a trick",
                  },
                },
              ],
            },
          ],
          type: 'custom:advanced-camera-card',
        });
        postUpgradeChecks(config);
      });

      it('should move PTZ from a stock conditional element', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'conditional',
              conditions: [{ entity: 'light.office', state: 'on' }],
              elements: [
                {
                  type: 'custom:advanced-camera-card-ptz',
                  orientation: 'vertical',
                  style: {
                    right: '20px',
                    top: '20px',
                    color: 'white',
                  },
                  actions_up: {
                    tap_action: {
                      action: 'call-service',
                      service: 'notify.persistent_notification',
                      service_data: {
                        message: 'Hello 1',
                      },
                    },
                  },
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          cameras: [{ camera_entity: 'camera.office' }],
          cameras_global: {
            ptz: {
              actions_up: {
                action: 'perform-action',
                data: {
                  message: 'Hello 1',
                },
                perform_action: 'notify.persistent_notification',
              },
            },
          },
          live: {
            controls: {
              ptz: {
                orientation: 'vertical',
                style: {
                  color: 'white',
                  right: '20px',
                  top: '20px',
                },
              },
            },
          },
          type: 'custom:advanced-camera-card',
        });
        postUpgradeChecks(config);
      });

      it('should not overwrite an existing live.controls.ptz', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          live: {
            controls: {
              ptz: {
                actions_up: {
                  tap_action: {
                    action: 'call-service',
                    data: {
                      message: 'Original',
                    },
                    service: 'notify.persistent_notification',
                  },
                },
                orientation: 'vertical',
                style: {
                  color: 'white',
                  right: '20px',
                  top: '20px',
                },
              },
            },
          },
          elements: [
            {
              type: 'custom:advanced-camera-card-ptz',
              orientation: 'vertical',
              style: {
                right: '20px',
                top: '20px',
                color: 'white',
              },
              actions_up: {
                tap_action: {
                  action: 'call-service',
                  service: 'notify.persistent_notification',
                  service_data: {
                    message: 'Replacement that should be ignored',
                  },
                },
              },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          cameras: [{ camera_entity: 'camera.office' }],
          cameras_global: {
            ptz: {
              actions_up: {
                action: 'perform-action',
                data: {
                  message: 'Original',
                },
                perform_action: 'notify.persistent_notification',
              },
            },
          },
          live: {
            controls: {
              ptz: {
                orientation: 'vertical',
                style: {
                  color: 'white',
                  right: '20px',
                  top: '20px',
                },
              },
            },
          },
          type: 'custom:advanced-camera-card',
        });
        postUpgradeChecks(config);
      });

      it('should not upgrade ptz settings-only config', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          live: {
            controls: {
              ptz: {
                type: 'gestures',
                hide_type: true,
                mode: 'on',
                orientation: 'vertical',
                position: 'bottom-right',
              },
            },
          },
        };
        expect(upgradeConfig(config)).toBeFalsy();
      });
    });

    it('should move view.timeout_seconds', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        view: {
          timeout_seconds: 200,
        },
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        view: {
          interaction_seconds: 200,
        },
      });
      postUpgradeChecks(config);
    });

    describe('should handle all and never action conditions', () => {
      describe('live', () => {
        describe('lazy_unload', () => {
          it('should handle all', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                lazy_unload: 'all',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                lazy_unload: ['unselected', 'hidden'],
              },
            });
            postUpgradeChecks(config);
          });
          it('should handle never', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                lazy_unload: 'never',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {},
            });
            postUpgradeChecks(config);
          });
          it('should handle another value', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                lazy_unload: 'unselected',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                lazy_unload: ['unselected'],
              },
            });
            postUpgradeChecks(config);
          });
        });

        describe('auto_play', () => {
          it('should handle all', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_play: 'all',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {},
            });
            postUpgradeChecks(config);
          });
          it('should handle never', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_play: 'never',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_play: [],
              },
            });
            postUpgradeChecks(config);
          });
          it('should handle another value', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_play: 'selected',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_play: ['selected'],
              },
            });
            postUpgradeChecks(config);
          });
        });
        describe('auto_pause', () => {
          it('should handle all', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_pause: 'all',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_pause: ['unselected', 'hidden'],
              },
            });
            postUpgradeChecks(config);
          });
          it('should handle never', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_pause: 'never',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {},
            });
            postUpgradeChecks(config);
          });
          it('should handle another value', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_pause: 'unselected',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_pause: ['unselected'],
              },
            });
            postUpgradeChecks(config);
          });
        });
        describe('auto_mute', () => {
          it('should handle all', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_mute: 'all',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {},
            });
            postUpgradeChecks(config);
          });
          it('should handle never', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_mute: 'never',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_mute: [],
              },
            });
            postUpgradeChecks(config);
          });
          it('should handle another value', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_mute: 'unselected',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_mute: ['unselected'],
              },
            });
            postUpgradeChecks(config);
          });
        });
        describe('auto_unmute', () => {
          it('should handle all', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_unmute: 'all',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_unmute: ['selected', 'visible', 'microphone'],
              },
            });
            postUpgradeChecks(config);
          });
          it('should handle never', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_unmute: 'never',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {},
            });
            postUpgradeChecks(config);
          });
          it('should handle another value', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_unmute: 'selected',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                auto_unmute: ['selected'],
              },
            });
            postUpgradeChecks(config);
          });
        });
      });

      describe('media_viewer', () => {
        describe('auto_play', () => {
          it('should handle all', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_play: 'all',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {},
            });
            postUpgradeChecks(config);
          });
          it('should handle never', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_play: 'never',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_play: [],
              },
            });
            postUpgradeChecks(config);
          });
          it('should handle another value', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_play: 'selected',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_play: ['selected'],
              },
            });
            postUpgradeChecks(config);
          });
        });
        describe('auto_pause', () => {
          it('should handle all', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_pause: 'all',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {},
            });
            postUpgradeChecks(config);
          });
          it('should handle never', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_pause: 'never',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_pause: [],
              },
            });
            postUpgradeChecks(config);
          });
          it('should handle another value', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_pause: 'unselected',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_pause: ['unselected'],
              },
            });
            postUpgradeChecks(config);
          });
        });
        describe('auto_mute', () => {
          it('should handle all', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_mute: 'all',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {},
            });
            postUpgradeChecks(config);
          });
          it('should handle never', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_mute: 'never',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_mute: [],
              },
            });
            postUpgradeChecks(config);
          });
          it('should handle another value', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_mute: 'unselected',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_mute: ['unselected'],
              },
            });
            postUpgradeChecks(config);
          });
        });
        describe('auto_unmute', () => {
          it('should handle all', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_unmute: 'all',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_unmute: ['selected', 'visible'],
              },
            });
            postUpgradeChecks(config);
          });
          it('should handle never', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_unmute: 'never',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {},
            });
            postUpgradeChecks(config);
          });
          it('should handle another value', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_unmute: 'selected',
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              media_viewer: {
                auto_unmute: ['selected'],
              },
            });
            postUpgradeChecks(config);
          });
        });
      });
    });

    describe('should rename thumbnails.media -> thumbnails.events_media_type', () => {
      it.each([['all' as const], ['clips' as const], ['snapshots' as const]])(
        'should handle %s',
        (mediaEventType: string) => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            live: {
              controls: {
                thumbnails: {
                  media: mediaEventType,
                },
              },
            },
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            ...(mediaEventType !== 'all' && {
              cameras_global: {
                media: {
                  events_type: mediaEventType,
                },
              },
            }),
            live: {
              controls: {
                thumbnails: {
                  // v8.0.0+ migration moves events_media_type to cameras_global .
                },
              },
            },
          });
          postUpgradeChecks(config);
        },
      );
    });

    describe('should rename timeline.media -> timeline.events_media_type', () => {
      it.each([['all' as const], ['clips' as const], ['snapshots' as const]])(
        'should handle %s',
        (mediaEventType: string) => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            timeline: {
              media: mediaEventType,
            },
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            timeline: {
              events_media_type: mediaEventType,
            },
          });
          postUpgradeChecks(config);
        },
      );
    });

    describe('should rename live.controls.timeline.media -> live.controls.timeline.events_media_type', () => {
      it.each([['all' as const], ['clips' as const], ['snapshots' as const]])(
        'should handle %s',
        (mediaEventType: string) => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            live: {
              controls: {
                timeline: {
                  media: mediaEventType,
                },
              },
            },
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            live: {
              controls: {
                timeline: {
                  events_media_type: mediaEventType,
                },
              },
            },
          });
          postUpgradeChecks(config);
        },
      );
    });

    describe('should rename media_viewer.controls.timeline.media -> media_viewer.controls.timeline.events_media_type', () => {
      it.each([['all' as const], ['clips' as const], ['snapshots' as const]])(
        'should handle %s',
        (mediaEventType: string) => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            media_viewer: {
              controls: {
                timeline: {
                  media: mediaEventType,
                },
              },
            },
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            media_viewer: {
              controls: {
                timeline: {
                  events_media_type: mediaEventType,
                },
              },
            },
          });
          postUpgradeChecks(config);
        },
      );
    });

    describe('should transform scan mode', () => {
      describe('should move and transform untrigger_reset', () => {
        it('should handle when true', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            view: {
              scan: {
                untrigger_reset: true,
              },
            },
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            view: {
              triggers: {
                actions: {
                  untrigger: 'default',
                },
              },
            },
          });
          postUpgradeChecks(config);
        });

        it('should handle when false', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            view: {
              scan: {
                untrigger_reset: false,
              },
            },
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            view: {
              triggers: {},
            },
          });
          postUpgradeChecks(config);
        });
      });

      describe('should rename view.scan.enabled to a trigger action', () => {
        it('should handle when true', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            view: {
              scan: {
                enabled: true,
              },
            },
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            view: {
              triggers: {
                filter_selected_camera: false,
                actions: {
                  trigger: 'live',
                },
              },
            },
          });
          postUpgradeChecks(config);
        });

        it('should handle when false', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            view: {
              scan: {
                enabled: false,
              },
            },
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            view: {
              triggers: {},
            },
          });
          postUpgradeChecks(config);
        });
      });
    });

    describe('should handle media layout changes', () => {
      it('should move live.layout -> cameras_global.dimensions', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: {
            layout: {
              fit: 'cover',
              position: {
                x: 42,
                y: 43,
              },
            },
          },
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: {},
          cameras_global: {
            dimensions: {
              layout: {
                fit: 'cover',
                position: {
                  x: 42,
                  y: 43,
                },
              },
            },
          },
        });
        postUpgradeChecks(config);
      });

      describe('from delete old media layouts', () => {
        it.each([['media_viewer' as const], ['image' as const]])(
          'should handle %s',
          (section: string) => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              [section]: {
                layout: {
                  fit: 'cover',
                  position: {
                    x: 42,
                    y: 43,
                  },
                },
              },
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              [section]: {},
            });
            postUpgradeChecks(config);
          },
        );
      });
    });

    describe('from condition object to condition array', () => {
      describe('with view condition', () => {
        it('should convert conditions on elements', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            elements: [
              {
                type: 'custom:random',
                conditions: {
                  view: ['clips', 'snapshots'],
                },
              },
              {
                type: 'custom:random2',
                conditions: 'not an object',
              },
            ],
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            elements: [
              {
                type: 'custom:random',
                conditions: [
                  {
                    condition: 'view' as const,
                    views: ['clips', 'snapshots'],
                  },
                ],
              },
              {
                type: 'custom:random2',
                conditions: 'not an object',
              },
            ],
          });
          postUpgradeChecks(config);
        });

        it('should convert conditions on overrides', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            overrides: [
              {
                conditions: {
                  view: ['clips', 'snapshots'],
                },
                overrides: {
                  view: {
                    default: 'clips',
                  },
                },
              },
            ],
          };

          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            overrides: [
              {
                conditions: [
                  {
                    condition: 'view' as const,
                    views: ['clips', 'snapshots'],
                  },
                ],
                merge: {
                  view: {
                    default: 'clips',
                  },
                },
              },
            ],
          });
          postUpgradeChecks(config);
        });

        it('should convert conditions on automations', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            automations: [
              {
                conditions: {
                  view: ['clips', 'snapshots'],
                },
                actions: [
                  {
                    action: 'custom:advanced-camera-card-action' as const,
                    advanced_camera_card_action: 'substream_on' as const,
                  },
                ],
              },
            ],
          };

          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            automations: [
              {
                triggers: [
                  {
                    trigger: 'view' as const,
                    views: ['clips', 'snapshots'],
                  },
                ],
                actions: [
                  {
                    action: 'custom:advanced-camera-card-action' as const,
                    advanced_camera_card_action: 'substream_on' as const,
                  },
                ],
              },
            ],
          });
          postUpgradeChecks(config);
        });
      });

      describe('with camera condition', () => {
        it('should convert conditions on elements', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            elements: [
              {
                type: 'custom:random',
                conditions: {
                  camera: ['camera_1', 'camera_2'],
                },
              },
              {
                type: 'custom:random2',
                conditions: 'not an object',
              },
            ],
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            elements: [
              {
                type: 'custom:random',
                conditions: [
                  {
                    condition: 'camera' as const,
                    cameras: ['camera_1', 'camera_2'],
                  },
                ],
              },
              {
                type: 'custom:random2',
                conditions: 'not an object',
              },
            ],
          });
          postUpgradeChecks(config);
        });

        it('should convert conditions on overrides', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            overrides: [
              {
                conditions: {
                  camera: ['camera_1', 'camera_2'],
                },
                overrides: {
                  view: {
                    default: 'clips',
                  },
                },
              },
            ],
          };

          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            overrides: [
              {
                conditions: [
                  {
                    condition: 'camera' as const,
                    cameras: ['camera_1', 'camera_2'],
                  },
                ],
                merge: {
                  view: {
                    default: 'clips',
                  },
                },
              },
            ],
          });
          postUpgradeChecks(config);
        });

        it('should convert conditions on automations', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            automations: [
              {
                conditions: {
                  camera: ['camera_1', 'camera_2'],
                },
                actions: [
                  {
                    action: 'custom:advanced-camera-card-action' as const,
                    advanced_camera_card_action: 'substream_on' as const,
                  },
                ],
              },
            ],
          };

          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            automations: [
              {
                triggers: [
                  {
                    trigger: 'camera' as const,
                    cameras: ['camera_1', 'camera_2'],
                  },
                ],
                actions: [
                  {
                    action: 'custom:advanced-camera-card-action' as const,
                    advanced_camera_card_action: 'substream_on' as const,
                  },
                ],
              },
            ],
          });
          postUpgradeChecks(config);
        });
      });

      describe('with boolean conditions', () => {
        describe.each([
          ['fullscreen' as const],
          ['expand' as const],
          ['media_loaded' as const],
        ])('%s', (condition: string) => {
          it('should convert conditions on elements', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{ camera_entity: 'camera.office' }],
              elements: [
                {
                  type: 'custom:random',
                  conditions: {
                    [condition]: true,
                  },
                },
                {
                  type: 'custom:random2',
                  conditions: 'not an object',
                },
              ],
            };
            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{ camera_entity: 'camera.office' }],
              elements: [
                {
                  type: 'custom:random',
                  conditions: [
                    {
                      condition: condition,
                      [condition]: true,
                    },
                  ],
                },
                {
                  type: 'custom:random2',
                  conditions: 'not an object',
                },
              ],
            });
            postUpgradeChecks(config);
          });

          it('should convert conditions on overrides', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{ camera_entity: 'camera.office' }],
              overrides: [
                {
                  conditions: {
                    [condition]: true,
                  },
                  overrides: {
                    view: {
                      default: 'clips',
                    },
                  },
                },
              ],
            };

            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{ camera_entity: 'camera.office' }],
              overrides: [
                {
                  conditions: [
                    {
                      condition: condition,
                      [condition]: true,
                    },
                  ],
                  merge: {
                    view: {
                      default: 'clips',
                    },
                  },
                },
              ],
            });
            postUpgradeChecks(config);
          });

          it('should convert conditions on automations', () => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{ camera_entity: 'camera.office' }],
              automations: [
                {
                  conditions: {
                    [condition]: true,
                  },
                  actions: [
                    {
                      action: 'custom:advanced-camera-card-action' as const,
                      advanced_camera_card_action: 'substream_on' as const,
                    },
                  ],
                },
              ],
            };

            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{ camera_entity: 'camera.office' }],
              automations: [
                {
                  triggers: [
                    {
                      trigger: condition,
                      [condition]: true,
                    },
                  ],
                  actions: [
                    {
                      action: 'custom:advanced-camera-card-action' as const,
                      advanced_camera_card_action: 'substream_on' as const,
                    },
                  ],
                },
              ],
            });
            postUpgradeChecks(config);
          });
        });
      });

      describe('with state condition', () => {
        it('should convert conditions on elements', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            elements: [
              {
                type: 'custom:random',
                conditions: {
                  state: [
                    {
                      entity: 'binary_sensor.first',
                      state: 'on',
                    },
                    {
                      entity: 'binary_sensor.second',
                      state_not: 'off',
                    },
                    {},
                  ],
                },
              },
              {
                type: 'custom:random2',
                conditions: 'not an object',
              },
            ],
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            elements: [
              {
                type: 'custom:random',
                conditions: [
                  {
                    condition: 'state' as const,
                    entity_id: 'binary_sensor.first',
                    state: 'on',
                  },
                  {
                    condition: 'state' as const,
                    entity_id: 'binary_sensor.second',
                    state_not: 'off',
                  },
                ],
              },
              {
                type: 'custom:random2',
                conditions: 'not an object',
              },
            ],
          });
          postUpgradeChecks(config);
        });

        it('should convert conditions on overrides', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            overrides: [
              {
                conditions: {
                  state: [
                    {
                      entity: 'binary_sensor.first',
                      state: 'on',
                    },
                    {
                      entity: 'binary_sensor.second',
                      state_not: 'off',
                    },
                    {},
                  ],
                },
                overrides: {
                  view: {
                    default: 'clips',
                  },
                },
              },
            ],
          };

          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            overrides: [
              {
                conditions: [
                  {
                    condition: 'state' as const,
                    entity_id: 'binary_sensor.first',
                    state: 'on',
                  },
                  {
                    condition: 'state' as const,
                    entity_id: 'binary_sensor.second',
                    state_not: 'off',
                  },
                ],
                merge: {
                  view: {
                    default: 'clips',
                  },
                },
              },
            ],
          });
          postUpgradeChecks(config);
        });

        it('should convert conditions on automations', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            automations: [
              {
                conditions: {
                  state: [
                    {
                      entity: 'binary_sensor.first',
                      state: 'on',
                    },
                    {
                      entity: 'binary_sensor.second',
                      state_not: 'off',
                    },
                    {},
                  ],
                },
                actions: [
                  {
                    action: 'custom:advanced-camera-card-action' as const,
                    advanced_camera_card_action: 'substream_on' as const,
                  },
                ],
              },
            ],
          };

          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            automations: [
              {
                conditions: [
                  {
                    condition: 'state' as const,
                    entity_id: 'binary_sensor.first',
                    state: 'on',
                  },
                  {
                    condition: 'state' as const,
                    entity_id: 'binary_sensor.second',
                    state_not: 'off',
                  },
                ],
                triggers: [
                  {
                    trigger: 'state' as const,
                    entity_id: 'binary_sensor.first',
                    to: 'on',
                  },
                  {
                    trigger: 'state' as const,
                    entity_id: 'binary_sensor.second',
                    not_to: 'off',
                  },
                ],
                actions: [
                  {
                    action: 'custom:advanced-camera-card-action' as const,
                    advanced_camera_card_action: 'substream_on' as const,
                  },
                ],
              },
            ],
          });
          postUpgradeChecks(config);
        });
      });

      describe('with media query condition', () => {
        it('should convert conditions on elements', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            elements: [
              {
                type: 'custom:random',
                conditions: {
                  media_query: 'query',
                },
              },
              {
                type: 'custom:random2',
                conditions: 'not an object',
              },
            ],
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            elements: [
              {
                type: 'custom:random',
                conditions: [
                  {
                    condition: 'screen' as const,
                    media_query: 'query',
                  },
                ],
              },
              {
                type: 'custom:random2',
                conditions: 'not an object',
              },
            ],
          });
          postUpgradeChecks(config);
        });

        it('should convert conditions on overrides', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            overrides: [
              {
                conditions: {
                  media_query: 'query',
                },
                overrides: {
                  view: {
                    default: 'clips',
                  },
                },
              },
            ],
          };

          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            overrides: [
              {
                conditions: [
                  {
                    condition: 'screen' as const,
                    media_query: 'query',
                  },
                ],
                merge: {
                  view: {
                    default: 'clips',
                  },
                },
              },
            ],
          });
          postUpgradeChecks(config);
        });

        it('should convert conditions on automations', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            automations: [
              {
                conditions: {
                  media_query: 'query',
                },
                actions: [
                  {
                    action: 'custom:advanced-camera-card-action' as const,
                    advanced_camera_card_action: 'substream_on' as const,
                  },
                ],
              },
            ],
          };

          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{ camera_entity: 'camera.office' }],
            automations: [
              {
                triggers: [
                  {
                    trigger: 'screen' as const,
                    media_query: 'query',
                  },
                ],
                actions: [
                  {
                    action: 'custom:advanced-camera-card-action' as const,
                    advanced_camera_card_action: 'substream_on' as const,
                  },
                ],
              },
            ],
          });
          postUpgradeChecks(config);
        });
      });
    });

    describe('from hide to substream capability disable', () => {
      it('should disable substream capability from a hidden camera', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [
            { camera_entity: 'camera.office', hide: true },
            { camera_entity: 'camera.sitting_room', hide: false },
          ],
        };

        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:advanced-camera-card',
          cameras: [
            {
              camera_entity: 'camera.office',
              capabilities: { disable_except: ['substream'] },
            },
            { camera_entity: 'camera.sitting_room' },
          ],
        });
        postUpgradeChecks(config);
      });

      describe('from performance profile to generic profile', () => {
        it('should migrate the low performance profile', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            performance: {
              profile: 'low',
            },
          };

          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            profiles: ['low-performance'],
            performance: {},
          });
          postUpgradeChecks(config);
        });

        it('should handle the high performance profile', () => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            performance: {
              profile: 'high',
            },
          };

          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            performance: {},
          });
          postUpgradeChecks(config);
        });
      });
    });

    it('should move overrides -> merge', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{}],
        overrides: [
          {
            conditions: [
              {
                condition: 'view',
                views: ['clips'],
              },
            ],
            overrides: {
              menu: {
                style: 'hidden',
              },
            },
          },
        ],
      };

      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{}],
        overrides: [
          {
            conditions: [
              {
                condition: 'view',
                views: ['clips'],
              },
            ],
            merge: {
              menu: {
                style: 'hidden',
              },
            },
          },
        ],
      });
      postUpgradeChecks(config);
    });

    describe('split live.ptz', () => {
      const getActionBefore = (action: PTZControlAction): CallServiceActionConfig => ({
        action: 'call-service',
        service: 'service',
        data: {
          arg: action,
        },
      });

      const getActionAfter = (action: PTZControlAction): PerformActionActionConfig => ({
        action: 'perform-action',
        perform_action: 'service',
        data: {
          arg: action,
        },
      });

      const getTapAction = (action: PTZControlAction): Actions => ({
        tap_action: getActionBefore(action),
      });

      it('should transform the action_ format', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: {
            controls: {
              ptz: {
                actions_up: getTapAction('up'),
                actions_down: getTapAction('down'),
                actions_left: getTapAction('left'),
                actions_right: getTapAction('right'),
                actions_zoom_in: getTapAction('zoom_in'),
                actions_zoom_out: getTapAction('zoom_out'),
                actions_home: {
                  ...getTapAction('home'),
                  double_tap_action: getActionBefore('up'),
                },

                mode: 'auto' as const,
                position: 'bottom-right' as const,
                orientation: 'horizontal' as const,
                hide_pan_tilt: false,
                hide_zoom: false,
                hide_home: false,
                style: {
                  color: 'red',
                },

                something_not_related: 'very_unrelated',
              },
            },
          },
        };

        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          cameras_global: {
            ptz: {
              actions_left: getActionAfter('left'),
              actions_right: getActionAfter('right'),
              actions_up: getActionAfter('up'),
              actions_down: getActionAfter('down'),
              actions_zoom_in: getActionAfter('zoom_in'),
              actions_zoom_out: getActionAfter('zoom_out'),
              presets: {
                home: getActionAfter('home'),
              },
            },
          },
          live: {
            controls: {
              ptz: {
                mode: 'auto' as const,
                position: 'bottom-right' as const,
                orientation: 'horizontal' as const,
                hide_pan_tilt: false,
                hide_zoom: false,
                hide_home: false,
                style: {
                  color: 'red',
                },
              },
            },
          },
        });
        postUpgradeChecks(config);
      });

      it('should transform the data_ format', () => {
        const getDataAction = (action: PTZControlAction): Actions => ({
          action: {
            device: '048123',
            cmd: action,
          },
        });

        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: {
            controls: {
              ptz: {
                service: 'service',
                data_up: getDataAction('up'),
                data_down: getDataAction('down'),
                data_left: getDataAction('left'),
                data_right: getDataAction('right'),
                data_zoom_in: getDataAction('zoom_in'),
                data_zoom_out: getDataAction('zoom_out'),
                data_home: getDataAction('home'),

                mode: 'auto' as const,
                position: 'bottom-right' as const,
                orientation: 'horizontal' as const,
                hide_pan_tilt: false,
                hide_zoom: false,
                hide_home: false,
                style: {
                  color: 'red',
                },

                something_not_related: 'very_unrelated',
              },
            },
          },
        };

        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          cameras_global: {
            ptz: {
              service: 'service',
              data_left: getDataAction('left'),
              data_right: getDataAction('right'),
              data_up: getDataAction('up'),
              data_down: getDataAction('down'),
              data_zoom_in: getDataAction('zoom_in'),
              data_zoom_out: getDataAction('zoom_out'),
              presets: {
                service: 'service',
                data_home: getDataAction('home'),
              },
            },
          },
          live: {
            controls: {
              ptz: {
                mode: 'auto' as const,
                position: 'bottom-right' as const,
                orientation: 'horizontal' as const,
                hide_pan_tilt: false,
                hide_zoom: false,
                hide_home: false,
                style: {
                  color: 'red',
                },
              },
            },
          },
        });
        postUpgradeChecks(config);
      });

      it('should handle an invalid ptz type', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: {
            controls: {
              ptz: 3, // Not an object.
            },
          },
        };

        expect(upgradeConfig(config)).toBeFalsy();
      });

      it('should handle nothing to transform', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: {
            controls: {
              ptz: {
                mode: 'auto',
              },
            },
          },
        };

        expect(upgradeConfig(config)).toBeFalsy();
      });

      it('should handle a missing tap_action', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: {
            controls: {
              ptz: {
                actions_up: {
                  double_tap_action: getActionBefore('up'),
                },
                actions_down: getTapAction('down'),
              },
            },
          },
        };

        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual(
          expect.objectContaining({
            cameras_global: {
              ptz: {
                actions_down: getActionAfter('down'),
              },
            },
          }),
        );
        postUpgradeChecks(config);
      });

      it('should handle no pre-existing presets', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: {
            controls: {
              ptz: {
                presets: {
                  home: getActionBefore('left'),
                  other: getActionBefore('right'),
                },
                actions_home: getTapAction('home'),
              },
            },
          },
        };

        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual(
          expect.objectContaining({
            cameras_global: {
              ptz: {
                presets: {
                  other: getActionAfter('right'),
                  home: getActionAfter('home'),
                },
              },
            },
          }),
        );
        postUpgradeChecks(config);
      });
    });

    it('should rename view.update_cycle_camera -> view.default_cycle_camera', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{}],
        view: {
          update_cycle_camera: true,
        },
      };

      expect(upgradeConfig(config)).toBeTruthy();
      expect(config.view).toEqual({
        default_cycle_camera: true,
      });
      postUpgradeChecks(config);
    });

    describe('view.update_force -> view.default_reset.interaction_mode', () => {
      it('should convert to all when true', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          view: {
            update_force: true,
          },
        };

        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.view).toEqual({
          default_reset: {
            interaction_mode: 'all',
          },
        });
        postUpgradeChecks(config);
      });

      it('should remove when false', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          view: {
            update_force: false,
          },
        };

        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.view).toEqual({});
        postUpgradeChecks(config);
      });
    });

    it('should move view.update_seconds', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{}],
        view: {
          update_seconds: 42,
        },
      };

      expect(upgradeConfig(config)).toBeTruthy();
      expect(config.view).toEqual({
        default_reset: {
          every_seconds: 42,
        },
      });
      postUpgradeChecks(config);
    });

    it('should move view.update_entities', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{}],
        view: {
          update_entities: ['binary_sensor.foo', 'camera.bar'],
        },
      };

      expect(upgradeConfig(config)).toBeTruthy();
      expect(config.view).toEqual({
        default_reset: {
          entities: ['binary_sensor.foo', 'camera.bar'],
        },
      });
      postUpgradeChecks(config);
    });

    describe('title controls to status bar', () => {
      it('should handle when mode is none', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: {
            controls: {
              title: {
                mode: 'none',
              },
            },
          },
          media_viewer: {
            controls: {
              title: {
                mode: 'none',
              },
            },
          },
        };

        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: { controls: {} },
          media_viewer: { controls: {} },
          status_bar: {
            style: 'none',
          },
        });

        postUpgradeChecks(config);
      });

      describe('when mode is invalid type', () => {
        it.each([[{ mode: { should_not_be: 'an object' } }], ['sideways']])(
          'should handle %s',
          (mode: unknown) => {
            const config = {
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: {
                controls: {
                  title: {
                    mode,
                  },
                },
              },
              media_viewer: {
                controls: {
                  title: {
                    mode,
                  },
                },
              },
            };

            expect(upgradeConfig(config)).toBeTruthy();
            expect(config).toEqual({
              type: 'custom:advanced-camera-card',
              cameras: [{}],
              live: { controls: {} },
              media_viewer: { controls: {} },
            });

            postUpgradeChecks(config);
          },
        );
      });

      describe.each([['bottom'], ['top']])('on the %s', (position: string) => {
        it.each([
          [`popup-${position}-left` as const],
          [`popup-${position}-right` as const],
        ])('should handle %s', (mode: string) => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            live: {
              controls: {
                title: {
                  mode,
                },
              },
            },
            media_viewer: {
              controls: {
                title: {
                  mode,
                },
              },
            },
          };

          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            live: { controls: {} },
            media_viewer: { controls: {} },
            status_bar: {
              position,
            },
          });

          postUpgradeChecks(config);
        });
      });
    });

    it('should rename call-service -> perform-action', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:cow',
            tap_action: {
              action: 'call-service',
              service: 'foo',
            },
          },
        ],
        view: {
          actions: {
            double_tap_action: {
              action: 'call-service',
              service: 'bar',
              data: {
                key: 'value',
              },
            },
          },
        },
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:cow',
            tap_action: {
              action: 'perform-action',
              perform_action: 'foo',
            },
          },
        ],
        view: {
          actions: {
            double_tap_action: {
              action: 'perform-action',
              perform_action: 'bar',
              data: {
                key: 'value',
              },
            },
          },
        },
      });
      postUpgradeChecks(config);
    });

    it('should rename dimensions.max_height -> dimensions.height', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        dimensions: {
          max_height: '500px',
        },
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        dimensions: {
          height: '500px',
        },
      });
      postUpgradeChecks(config);
    });

    it('should delete dimensions.min_height', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        dimensions: {
          min_height: '100px',
        },
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        dimensions: {},
      });
      postUpgradeChecks(config);
    });
  });

  describe('v6.1.2+', () => {
    describe('view.dark_mode -> view.dim', () => {
      it.each([
        ['on' as const, true],
        ['auto' as const, false],
        ['off' as const, false],
      ])('should handle %s', (darkMode: 'on' | 'off' | 'auto', expected: boolean) => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          view: {
            dark_mode: darkMode,
          },
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          view: {
            dim: expected,
          },
        });
        postUpgradeChecks(config);
      });
    });
  });

  describe('v7.0.0+', () => {
    it('should rename custom:frigate-card -> custom:advanced-camera-card', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{}],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{}],
      });
      postUpgradeChecks(config);
    });

    it('should rename custom:frigate-card-action -> custom:advanced-camera-card-action', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:cow',
            tap_action: {
              action: 'custom:frigate-card-action',
              advanced_camera_card_action: 'camera_ui',
            },
          },
        ],
        view: {
          actions: {
            double_tap_action: {
              action: 'custom:frigate-card-action',
              advanced_camera_card_action: 'camera_ui',
            },
          },
        },
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:cow',
            tap_action: {
              action: 'custom:advanced-camera-card-action',
              advanced_camera_card_action: 'camera_ui',
            },
          },
        ],
        view: {
          actions: {
            double_tap_action: {
              action: 'custom:advanced-camera-card-action',
              advanced_camera_card_action: 'camera_ui',
            },
          },
        },
      });
      postUpgradeChecks(config);
    });

    it('should rename custom:frigate-card-menu-icon -> custom:advanced-camera-card-menu-icon', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:frigate-card-menu-icon',
            icon: 'mdi:cow',
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:advanced-camera-card-menu-icon',
            icon: 'mdi:cow',
          },
        ],
      });
      postUpgradeChecks(config);
    });

    it('should rename custom:frigate-card-menu-state-icon -> custom:advanced-camera-card-menu-state-icon', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:frigate-card-menu-state-icon',
            entity: 'binary_sensor.office',
            icon: 'mdi:cow',
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:advanced-camera-card-menu-state-icon',
            entity: 'binary_sensor.office',
            icon: 'mdi:cow',
          },
        ],
      });
      postUpgradeChecks(config);
    });

    it('should rename custom:frigate-card-menu-submenu -> custom:advanced-camera-card-menu-submenu', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:frigate-card-menu-submenu',
            icon: 'mdi:cow',
            items: [],
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:advanced-camera-card-menu-submenu',
            icon: 'mdi:cow',
            items: [],
          },
        ],
      });
      postUpgradeChecks(config);
    });

    it('should rename custom:frigate-card-status-bar-icon -> custom:advanced-camera-card-status-bar-icon', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:frigate-card-status-bar-icon',
            icon: 'mdi:cow',
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:advanced-camera-card-status-bar-icon',
            icon: 'mdi:cow',
          },
        ],
      });
      postUpgradeChecks(config);
    });

    it('should rename custom:frigate-card-status-bar-image -> custom:advanced-camera-card-status-bar-image', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:frigate-card-status-bar-image',
            image: 'image',
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:advanced-camera-card-status-bar-image',
            image: 'image',
          },
        ],
      });
      postUpgradeChecks(config);
    });

    it('should rename custom:frigate-card-status-bar-string -> custom:advanced-camera-card-status-bar-string', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:frigate-card-status-bar-string',
            string: 'string',
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:advanced-camera-card-status-bar-string',
            string: 'string',
          },
        ],
      });
      postUpgradeChecks(config);
    });

    it('should rename custom:frigate-card-conditional -> custom:advanced-camera-card-conditional', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:frigate-card-conditional',
            conditions: [],
            elements: [],
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:advanced-camera-card-conditional',
            conditions: [],
            elements: [],
          },
        ],
      });
      postUpgradeChecks(config);
    });

    it('should rename frigate_card_action -> advanced_camera_card_action', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:cow',
            tap_action: {
              action: 'custom:advanced-camera-card-action',
              frigate_card_action: 'camera_ui',
            },
          },
        ],
        view: {
          actions: {
            double_tap_action: {
              action: 'custom:advanced-camera-card-action',
              frigate_card_action: 'camera_ui',
            },
          },
        },
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:cow',
            tap_action: {
              action: 'custom:advanced-camera-card-action',
              advanced_camera_card_action: 'camera_ui',
            },
          },
        ],
        view: {
          actions: {
            double_tap_action: {
              action: 'custom:advanced-camera-card-action',
              advanced_camera_card_action: 'camera_ui',
            },
          },
        },
      });
      postUpgradeChecks(config);
    });

    describe('frigate card style overrides -> advanced camera card style overrides', () => {
      it('should rename valid style overrides', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          view: {
            theme: {
              overrides: {
                '--zero': 'zero',
                '--frigate-card-one': 'one',
              },
            },
          },
          overrides: [
            {
              conditions: [
                {
                  condition: 'media_loaded' as const,
                  media_loaded: true,
                },
              ],
              merge: {
                view: {
                  theme: {
                    overrides: {
                      '--frigate-card-two': 'two',
                    },
                  },
                },
              },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          view: {
            theme: {
              overrides: {
                '--zero': 'zero',
                '--advanced-camera-card-one': 'one',
              },
            },
          },
          overrides: [
            {
              conditions: [
                {
                  condition: 'media_loaded' as const,
                  media_loaded: true,
                },
              ],
              merge: {
                view: {
                  theme: {
                    overrides: {
                      '--advanced-camera-card-two': 'two',
                    },
                  },
                },
              },
            },
          ],
        });
        postUpgradeChecks(config);
      });

      it('should handle invalid style overrides', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          view: {
            theme: {
              overrides: ['should', 'not', 'be', 'an', 'array'],
            },
          },
        };
        expect(upgradeConfig(config)).toBeFalsy();
      });
    });

    it('should rename the frigate card button -> the iris button', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        menu: {
          buttons: {
            frigate: {
              icon: 'mdi:cow',
            },
          },
        },
        overrides: [
          {
            conditions: [
              {
                condition: 'media_loaded' as const,
                media_loaded: true,
              },
            ],
            merge: {
              menu: {
                buttons: {
                  frigate: {
                    icon: 'mdi:cow',
                  },
                },
              },
            },
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{ camera_entity: 'camera.office' }],
        menu: {
          buttons: {
            iris: {
              icon: 'mdi:cow',
            },
          },
        },
        overrides: [
          {
            conditions: [
              {
                condition: 'media_loaded' as const,
                media_loaded: true,
              },
            ],
            merge: {
              menu: {
                buttons: {
                  iris: {
                    icon: 'mdi:cow',
                  },
                },
              },
            },
          },
        ],
      });
      postUpgradeChecks(config);
    });
  });

  describe('v8.0.0+', () => {
    describe('live.controls.thumbnails.media_type -> cameras_global.media.type', () => {
      it.each([['events' as const], ['recordings' as const]])(
        'should handle %s',
        (mediaType: string) => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            live: {
              controls: {
                thumbnails: {
                  media_type: mediaType,
                },
              },
            },
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            live: {
              controls: {
                thumbnails: {},
              },
            },
            cameras_global: {
              media: {
                type: mediaType,
              },
            },
          });
          postUpgradeChecks(config);
        },
      );
    });

    describe('live.controls.thumbnails.events_media_type -> cameras_global.media.events_type', () => {
      it.each([['clips' as const], ['snapshots' as const]])(
        'should handle %s',
        (eventsType: string) => {
          const config = {
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            live: {
              controls: {
                thumbnails: {
                  events_media_type: eventsType,
                },
              },
            },
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:advanced-camera-card',
            cameras: [{}],
            live: {
              controls: {
                thumbnails: {},
              },
            },
            cameras_global: {
              media: {
                events_type: eventsType,
              },
            },
          });
          postUpgradeChecks(config);
        },
      );

      it('should handle all', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: {
            controls: {
              thumbnails: {
                events_media_type: 'all',
              },
            },
          },
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          live: {
            controls: {
              thumbnails: {},
            },
          },
        });
        postUpgradeChecks(config);
      });
    });

    it('should rename view.triggers.untrigger_seconds -> view.triggers.untrigger_delay_seconds', () => {
      const config = {
        type: 'custom:advanced-camera-card',
        cameras: [{}],
        view: {
          triggers: {
            untrigger_seconds: 42,
          },
        },
        overrides: [
          {
            conditions: [
              {
                condition: 'media_loaded' as const,
                media_loaded: true,
              },
            ],
            merge: {
              view: {
                triggers: {
                  untrigger_seconds: 7,
                },
              },
            },
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:advanced-camera-card',
        cameras: [{}],
        view: {
          triggers: {
            untrigger_delay_seconds: 42,
          },
        },
        overrides: [
          {
            conditions: [
              {
                condition: 'media_loaded' as const,
                media_loaded: true,
              },
            ],
            merge: {
              view: {
                triggers: {
                  untrigger_delay_seconds: 7,
                },
              },
            },
          },
        ],
      });
      postUpgradeChecks(config);
    });

    describe('ptz data_*_start/stop -> data_start/end_* (WebRTC ordering)', () => {
      it('should transform in cameras_global.ptz', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          cameras_global: {
            ptz: {
              service: 'service.ptz',
              data_left_start: { cmd: 'left_start' },
              data_left_stop: { cmd: 'left_stop' },
            },
          },
        };

        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.cameras_global.ptz).toEqual({
          service: 'service.ptz',
          data_start_left: { cmd: 'left_start' },
          data_end_left: { cmd: 'left_stop' },
        });
        postUpgradeChecks(config);
      });

      it('should transform in cameras[n].ptz', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [
            {
              ptz: {
                service: 'service.ptz',
                data_right_start: { cmd: 'right_start' },
                data_right_stop: { cmd: 'right_stop' },
              },
            },
          ],
        };

        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.cameras[0].ptz).toEqual({
          service: 'service.ptz',
          data_start_right: { cmd: 'right_start' },
          data_end_right: { cmd: 'right_stop' },
        });
        postUpgradeChecks(config);
      });

      it('should ignore a non-object ptz value', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          cameras_global: {
            ptz: 'not-an-object',
          },
        };

        expect(upgradeConfig(config)).toBeFalsy();
      });

      it('should not overwrite an existing WebRTC key', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{}],
          cameras_global: {
            ptz: {
              service: 'service.ptz',
              data_left_stop: { cmd: 'old' },
              data_end_left: { cmd: 'new' },
            },
          },
        };

        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.cameras_global.ptz).toEqual({
          service: 'service.ptz',
          data_end_left: { cmd: 'new' },
        });
        postUpgradeChecks(config);
      });
    });

    describe('microphone.connected -> call condition', () => {
      it('should rewrite connected:true -> call:true in an automation', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ condition: 'microphone', connected: true }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'live',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual(
          expect.objectContaining({ triggers: [{ trigger: 'call', call: true }] }),
        );
        postUpgradeChecks(config);
      });

      it('should rewrite connected:false -> call:false', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ condition: 'microphone', connected: false }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'live',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual(
          expect.objectContaining({ triggers: [{ trigger: 'call', call: false }] }),
        );
        postUpgradeChecks(config);
      });

      it('should not convert a microphone.muted only condition to call', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ condition: 'microphone', muted: true }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'live',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual(
          expect.objectContaining({
            triggers: [{ trigger: 'microphone', muted: true }],
          }),
        );
        postUpgradeChecks(config);
      });

      it('should split a condition with both connected and muted into an AND condition', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ condition: 'microphone', connected: true, muted: false }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'live',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0].conditions).toEqual([
          {
            condition: 'and',
            conditions: [
              { condition: 'call', call: true },
              { condition: 'microphone', muted: false },
            ],
          },
        ]);
        postUpgradeChecks(config);
      });

      it('should migrate a microphone.connected nested under or/and/not', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [
                {
                  condition: 'or',
                  conditions: [
                    {
                      condition: 'and',
                      conditions: [
                        {
                          condition: 'not',
                          conditions: [{ condition: 'microphone', connected: true }],
                        },
                      ],
                    },
                  ],
                },
              ],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'live',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0].conditions).toEqual([
          {
            condition: 'or',
            conditions: [
              {
                condition: 'and',
                conditions: [
                  {
                    condition: 'not',
                    conditions: [{ condition: 'call', call: true }],
                  },
                ],
              },
            ],
          },
        ]);
        postUpgradeChecks(config);
      });

      it('should migrate conditions on elements and overrides', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'custom:advanced-camera-card-conditional',
              conditions: [{ condition: 'microphone', connected: true }],
              elements: [{ type: 'icon', icon: 'mdi:phone' }],
            },
          ],
          overrides: [
            {
              conditions: [{ condition: 'microphone', connected: false }],
              merge: {},
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.elements[0].conditions).toEqual([
          { condition: 'call', call: true },
        ]);
        expect(config.overrides[0].conditions).toEqual([
          { condition: 'call', call: false },
        ]);
        postUpgradeChecks(config);
      });

      it('should be idempotent', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ condition: 'microphone', connected: true }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'live',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();

        // Running upgradeConfig again should not change anything.
        expect(upgradeConfig(config)).toBeFalsy();
        expect(config.automations[0]).toEqual(
          expect.objectContaining({ triggers: [{ trigger: 'call', call: true }] }),
        );
        postUpgradeChecks(config);
      });
    });

    describe('automation conditions -> triggers', () => {
      it('should flatten a composite condition into trigger leaves and keep the composite', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [
                {
                  condition: 'or',
                  conditions: [
                    { condition: 'camera', cameras: ['front'] },
                    { condition: 'view', views: ['live'] },
                  ],
                },
              ],
              actions: [
                { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual({
          conditions: [
            {
              condition: 'or',
              conditions: [
                { condition: 'camera', cameras: ['front'] },
                { condition: 'view', views: ['live'] },
              ],
            },
          ],
          triggers: [
            { trigger: 'camera', cameras: ['front'] },
            { trigger: 'view', views: ['live'] },
          ],
          actions: [{ action: 'fire-dom-event', advanced_camera_card_action: 'live' }],
        });
        postUpgradeChecks(config);
      });

      it('should leave non-object conditions untouched while rewriting the rest', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [
                'not-a-condition',
                { condition: 'camera', cameras: ['front'] },
              ],
              actions: [
                { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual({
          conditions: ['not-a-condition', { condition: 'camera', cameras: ['front'] }],
          triggers: ['not-a-condition', { trigger: 'camera', cameras: ['front'] }],
          actions: [{ action: 'fire-dom-event', advanced_camera_card_action: 'live' }],
        });
      });

      it('should leave an automation with no conditions untouched', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              actions: [
                { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
              ],
            },
          ],
        };
        upgradeConfig(config);
        expect(config.automations[0]).toEqual({
          actions: [{ action: 'fire-dom-event', advanced_camera_card_action: 'live' }],
        });
      });

      it('should map a discriminator-less state condition to a state trigger', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ entity: 'binary_sensor.x', state: 'on' }],
              actions: [
                { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual({
          triggers: [{ trigger: 'state', entity_id: 'binary_sensor.x', to: 'on' }],
          actions: [{ action: 'fire-dom-event', advanced_camera_card_action: 'live' }],
        });
        postUpgradeChecks(config);
      });

      it('should drop a composite with no nested conditions from the trigger list', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [
                { condition: 'or' },
                { condition: 'camera', cameras: ['front'] },
              ],
              actions: [
                { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
              ],
            },
          ],
        };
        upgradeConfig(config);
        expect(config.automations[0]).toEqual({
          conditions: [{ condition: 'or' }, { condition: 'camera', cameras: ['front'] }],
          triggers: [{ trigger: 'camera', cameras: ['front'] }],
          actions: [{ action: 'fire-dom-event', advanced_camera_card_action: 'live' }],
        });
      });

      it('should promote stock numeric_state and template by swapping the discriminator', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [
                { condition: 'numeric_state', entity_id: 'sensor.t', above: 25 },
                { condition: 'template', value_template: '{{ true }}' },
              ],
              actions: [
                { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual({
          conditions: [
            { condition: 'numeric_state', entity_id: 'sensor.t', above: 25 },
            { condition: 'template', value_template: '{{ true }}' },
          ],
          triggers: [
            { trigger: 'numeric_state', entity_id: 'sensor.t', above: 25 },
            { trigger: 'template', value_template: '{{ true }}' },
          ],
          actions: [{ action: 'fire-dom-event', advanced_camera_card_action: 'live' }],
        });
        postUpgradeChecks(config);
      });

      it('should drop a trigger-only condition from the retained conditions', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [
                { condition: 'camera' },
                { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
              ],
              actions: [
                { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual({
          conditions: [
            { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
          ],
          triggers: [
            { trigger: 'camera' },
            { trigger: 'state', entity_id: 'binary_sensor.door', to: 'on' },
          ],
          actions: [{ action: 'fire-dom-event', advanced_camera_card_action: 'live' }],
        });
        postUpgradeChecks(config);
      });

      it('should drop the conditions block when all are trigger-only', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ condition: 'camera' }, { condition: 'view' }],
              actions: [
                { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual({
          triggers: [{ trigger: 'camera' }, { trigger: 'view' }],
          actions: [{ action: 'fire-dom-event', advanced_camera_card_action: 'live' }],
        });
        postUpgradeChecks(config);
      });

      it('should prune trigger-only leaves from a retained composite', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [
                {
                  condition: 'or',
                  conditions: [
                    { condition: 'camera' },
                    { condition: 'view', views: ['live'] },
                  ],
                },
              ],
              actions: [
                { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual({
          conditions: [
            { condition: 'or', conditions: [{ condition: 'view', views: ['live'] }] },
          ],
          triggers: [{ trigger: 'camera' }, { trigger: 'view', views: ['live'] }],
          actions: [{ action: 'fire-dom-event', advanced_camera_card_action: 'live' }],
        });
        postUpgradeChecks(config);
      });

      it('should drop a composite whose leaves are all trigger-only', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [
                { condition: 'or', conditions: [{ condition: 'camera' }] },
                { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
              ],
              actions: [
                { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual({
          conditions: [
            { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
          ],
          triggers: [
            { trigger: 'camera' },
            { trigger: 'state', entity_id: 'binary_sensor.door', to: 'on' },
          ],
          actions: [{ action: 'fire-dom-event', advanced_camera_card_action: 'live' }],
        });
        postUpgradeChecks(config);
      });

      it('should promote a config condition to a config trigger', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [
                { condition: 'config', paths: ['menu.style'] },
                { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
              ],
              actions: [
                { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0]).toEqual({
          conditions: [
            { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
          ],
          triggers: [
            { trigger: 'config', paths: ['menu.style'] },
            { trigger: 'state', entity_id: 'binary_sensor.door', to: 'on' },
          ],
          actions: [{ action: 'fire-dom-event', advanced_camera_card_action: 'live' }],
        });
        postUpgradeChecks(config);
      });
    });

    describe('trigger-only conditions in overrides and elements', () => {
      it('should drop an override gated only on a config condition', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          overrides: [
            {
              conditions: [{ condition: 'config', paths: ['menu.style'] }],
              merge: { menu: { style: 'none' } },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.overrides).toEqual([]);
        postUpgradeChecks(config);
      });

      it('should strip a config condition from an override with other conditions', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          overrides: [
            {
              conditions: [
                { condition: 'config', paths: ['menu.style'] },
                { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
              ],
              merge: { menu: { style: 'none' } },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.overrides).toEqual([
          {
            conditions: [
              { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
            ],
            merge: { menu: { style: 'none' } },
          },
        ]);
        postUpgradeChecks(config);
      });

      it('should drop an override gated only on a valueless camera condition', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          overrides: [
            {
              conditions: [{ condition: 'camera' }],
              merge: { menu: { style: 'none' } },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.overrides).toEqual([]);
        postUpgradeChecks(config);
      });

      it('should drop a conditional element gated only on a config condition', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'custom:advanced-camera-card-conditional',
              conditions: [{ condition: 'config', paths: ['menu.style'] }],
              elements: [{ type: 'icon', icon: 'mdi:cow' }],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.elements).toBeUndefined();
        postUpgradeChecks(config);
      });

      it('should strip a config condition from a conditional element with other conditions', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'custom:advanced-camera-card-conditional',
              conditions: [
                { condition: 'config', paths: ['menu.style'] },
                { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
              ],
              elements: [{ type: 'icon', icon: 'mdi:cow' }],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.elements).toEqual([
          {
            type: 'custom:advanced-camera-card-conditional',
            conditions: [
              { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
            ],
            elements: [{ type: 'icon', icon: 'mdi:cow' }],
          },
        ]);
        postUpgradeChecks(config);
      });

      it('should recurse into nested conditional elements, keeping siblings', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'custom:advanced-camera-card-conditional',
              conditions: [
                { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
              ],
              elements: [
                { type: 'icon', icon: 'mdi:cow' },
                {
                  type: 'custom:advanced-camera-card-conditional',
                  conditions: [{ condition: 'config', paths: ['menu.style'] }],
                  elements: [{ type: 'icon', icon: 'mdi:pig' }],
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.elements).toEqual([
          {
            type: 'custom:advanced-camera-card-conditional',
            conditions: [
              { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
            ],
            elements: [{ type: 'icon', icon: 'mdi:cow' }],
          },
        ]);
        postUpgradeChecks(config);
      });

      it('should leave malformed gated entries (no conditions / no elements) untouched', () => {
        // These shapes are schema-invalid, so the transform must not crash on
        // them (a non-object override, a gate without a `conditions` array, a
        // conditional without an `elements` array); it simply leaves them as-is.
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          overrides: ['malformed', { merge: {} }],
          elements: [
            {
              type: 'custom:advanced-camera-card-conditional',
              conditions: [
                { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
              ],
            },
          ],
        };
        upgradeConfig(config);
        expect(config.overrides).toEqual(['malformed', { merge: {} }]);
        expect(config.elements).toEqual([
          {
            type: 'custom:advanced-camera-card-conditional',
            conditions: [
              { condition: 'state', entity_id: 'binary_sensor.door', state: 'on' },
            ],
          },
        ]);
      });
    });

    describe('trigger template paths -> top-level trigger.*', () => {
      it('should rewrite every legacy trigger path in an automation action', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              triggers: [{ trigger: 'state', entity_id: 'binary_sensor.door' }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'log',
                  message:
                    '{{ acc.trigger.state.entity }} {{ acc.trigger.state.from }} ' +
                    '{{ acc.trigger.state.to }} {{ acc.trigger.camera.from }} ' +
                    '{{ acc.trigger.camera.to }} {{ acc.trigger.view.from }} ' +
                    '{{ acc.trigger.view.to }} {{ acc.trigger.config.from }} ' +
                    '{{ acc.trigger.config.to }}',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0].actions[0].message).toBe(
          '{{ trigger.entity_id }} {{ trigger.from_state.state }} ' +
            '{{ trigger.to_state.state }} {{ trigger.from_acc.camera }} ' +
            '{{ trigger.to_acc.camera }} {{ trigger.from_acc.view }} ' +
            '{{ trigger.to_acc.view }} {{ trigger.from_acc.config }} ' +
            '{{ trigger.to_acc.config }}',
        );
        postUpgradeChecks(config);
      });

      it('should also migrate the long advanced_camera_card prefix', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              triggers: [{ trigger: 'state', entity_id: 'binary_sensor.door' }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'log',
                  message: '{{ advanced_camera_card.trigger.state.to }}',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0].actions[0].message).toBe(
          '{{ trigger.to_state.state }}',
        );
        postUpgradeChecks(config);
      });

      it('should rewrite paths in a non-automation menu action', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'custom:advanced-camera-card-menu-icon',
              icon: 'mdi:cctv',
              tap_action: {
                action: 'fire-dom-event',
                advanced_camera_card_action: 'camera_select',
                camera: '{{ acc.trigger.camera.to }}',
              },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.elements[0].tap_action.camera).toBe('{{ trigger.to_acc.camera }}');
        postUpgradeChecks(config);
      });

      it('should not rewrite a string without a template marker', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              triggers: [{ trigger: 'state', entity_id: 'binary_sensor.door' }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'log',
                  // No `{{` or `{%`, so it is opaque text, not a template, and is
                  // left alone.
                  message: 'see acc.trigger.state.to for details',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeFalsy();
        expect(config.automations[0].actions[0].message).toBe(
          'see acc.trigger.state.to for details',
        );
        postUpgradeChecks(config);
      });

      it('should migrate a path inside a statement-only template', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              triggers: [{ trigger: 'state', entity_id: 'binary_sensor.door' }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'log',
                  // A `{% %}` statement with no `{{` is still a template.
                  message: "{% if acc.trigger.state.to == 'on' %}on{% endif %}",
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0].actions[0].message).toBe(
          "{% if trigger.to_state.state == 'on' %}on{% endif %}",
        );
        postUpgradeChecks(config);
      });

      it('should migrate the config trigger path', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              triggers: [{ trigger: 'config' }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'log',
                  message: '{{ acc.trigger.config.to }}',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0].actions[0].message).toBe(
          '{{ trigger.to_acc.config }}',
        );
        postUpgradeChecks(config);
      });

      it('should be idempotent', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              triggers: [{ trigger: 'state', entity_id: 'binary_sensor.door' }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'log',
                  message: '{{ acc.trigger.state.to }}',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(upgradeConfig(config)).toBeFalsy();
        expect(config.automations[0].actions[0].message).toBe(
          '{{ trigger.to_state.state }}',
        );
      });
    });

    describe('cameras[].triggers.events string[] -> triggers.media_events', () => {
      it('should migrate a legacy string array to media_events', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [
            {
              camera_entity: 'camera.office',
              triggers: { events: ['events', 'clips'] },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.cameras[0].triggers).toEqual({
          media_events: ['events', 'clips'],
        });
        postUpgradeChecks(config);
      });

      it('should migrate an empty legacy array', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office', triggers: { events: [] } }],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.cameras[0].triggers).toEqual({ media_events: [] });
        postUpgradeChecks(config);
      });

      it('should leave the new object-array shape untouched', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [
            {
              camera_entity: 'camera.office',
              triggers: { events: [{ event_type: 'zha_event' }] },
            },
          ],
        };
        // The new shape might still trigger OTHER upgrades to fire on the
        // config, so we don't assert the overall upgrade result -- only that
        // this specific field is not touched.
        upgradeConfig(config);
        expect(config.cameras[0].triggers).toEqual({
          events: [{ event_type: 'zha_event' }],
        });
      });

      it('should drop legacy events but keep an existing media_events untouched', () => {
        // Both fields present is implausible in real user configs, but if it
        // happens we still must remove the legacy `events: string[]` because
        // the new schema would reject it; the explicit `media_events` wins.
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [
            {
              camera_entity: 'camera.office',
              triggers: {
                events: ['snapshots'],
                media_events: ['clips'],
              },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.cameras[0].triggers).toEqual({
          media_events: ['clips'],
        });
        postUpgradeChecks(config);
      });

      it('should be idempotent across repeated runs', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [
            {
              camera_entity: 'camera.office',
              triggers: { events: ['events'] },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(upgradeConfig(config)).toBeFalsy();
        expect(config.cameras[0].triggers).toEqual({ media_events: ['events'] });
      });

      it('should migrate per camera independently', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [
            { camera_entity: 'camera.a', triggers: { events: ['clips'] } },
            {
              camera_entity: 'camera.b',
              triggers: { events: [{ event_type: 'zha_event' }] },
            },
            { camera_entity: 'camera.c' },
          ],
        };
        upgradeConfig(config);
        expect(config.cameras[0].triggers).toEqual({ media_events: ['clips'] });
        expect(config.cameras[1].triggers).toEqual({
          events: [{ event_type: 'zha_event' }],
        });
        expect(config.cameras[2].triggers).toBeUndefined();
      });

      it('should migrate a legacy cameras_global.triggers.events string array', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          cameras_global: {
            triggers: {
              events: ['clips', 'snapshots'],
            },
          },
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.cameras_global.triggers).toEqual({
          media_events: ['clips', 'snapshots'],
        });
        postUpgradeChecks(config);
      });

      it('should leave cameras_global new-shape events untouched', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          cameras_global: {
            triggers: {
              events: [{ event_type: 'zha_event' }],
            },
          },
        };
        upgradeConfig(config);
        expect(config.cameras_global.triggers).toEqual({
          events: [{ event_type: 'zha_event' }],
        });
      });

      it('should be a no-op when triggers is not an object', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office', triggers: 'not-an-object' }],
        };
        upgradeConfig(config);
        expect(config.cameras[0].triggers).toBe('not-an-object');
      });
    });

    describe('live_substream_{on,off,select} -> substream_{on,off}', () => {
      it('should rewrite live_substream_on -> substream_on in an automation', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ condition: 'initialized' }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'live_substream_on',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0].actions).toEqual([
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'substream_on',
          },
        ]);
        postUpgradeChecks(config);
      });

      it('should rewrite live_substream_off -> substream_off in an automation', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ condition: 'initialized' }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'live_substream_off',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0].actions).toEqual([
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'substream_off',
          },
        ]);
        postUpgradeChecks(config);
      });

      it('should rewrite live_substream_select -> substream_on with camera -> stream', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ condition: 'initialized' }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'live_substream_select',
                  camera: 'camera.office_hd',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0].actions).toEqual([
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'substream_on',
            stream: 'camera.office_hd',
          },
        ]);
        postUpgradeChecks(config);
      });

      it('should rewrite a malformed live_substream_select with no camera field', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ condition: 'initialized' }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'live_substream_select',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.automations[0].actions).toEqual([
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'substream_on',
          },
        ]);
        postUpgradeChecks(config);
      });

      it('should migrate actions on elements and overrides', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'custom:advanced-camera-card-menu-icon',
              icon: 'mdi:video-input-component',
              tap_action: {
                action: 'fire-dom-event',
                advanced_camera_card_action: 'live_substream_select',
                camera: 'camera.office_hd',
              },
            },
          ],
          overrides: [
            {
              conditions: [{ condition: 'fullscreen', fullscreen: true }],
              merge: {
                menu: {
                  buttons: {
                    substreams: {
                      tap_action: {
                        action: 'fire-dom-event',
                        advanced_camera_card_action: 'live_substream_on',
                      },
                    },
                  },
                },
              },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config.elements[0].tap_action).toEqual({
          action: 'fire-dom-event',
          advanced_camera_card_action: 'substream_on',
          stream: 'camera.office_hd',
        });
        expect(config.overrides[0].merge.menu.buttons.substreams.tap_action).toEqual({
          action: 'fire-dom-event',
          advanced_camera_card_action: 'substream_on',
        });
        postUpgradeChecks(config);
      });

      it('should leave opaque user payloads alone', () => {
        // A perform-action service payload that happens to mention the legacy
        // action string in its `data` block must not be rewritten -- `data` is
        // opaque, not an action.
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              triggers: [{ trigger: 'initialized' }],
              actions: [
                {
                  action: 'perform-action',
                  perform_action: 'script.bogus',
                  data: {
                    advanced_camera_card_action: 'live_substream_select',
                    camera: 'camera.office_hd',
                  },
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeFalsy();
        expect(config.automations[0].actions[0]).toEqual({
          action: 'perform-action',
          perform_action: 'script.bogus',
          data: {
            advanced_camera_card_action: 'live_substream_select',
            camera: 'camera.office_hd',
          },
        });
      });

      it('should be idempotent', () => {
        const config = {
          type: 'custom:advanced-camera-card',
          cameras: [{ camera_entity: 'camera.office' }],
          automations: [
            {
              conditions: [{ condition: 'initialized' }],
              actions: [
                {
                  action: 'fire-dom-event',
                  advanced_camera_card_action: 'live_substream_select',
                  camera: 'camera.office_hd',
                },
              ],
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();

        // Running upgradeConfig again should not change anything.
        expect(upgradeConfig(config)).toBeFalsy();
        expect(config.automations[0].actions).toEqual([
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'substream_on',
            stream: 'camera.office_hd',
          },
        ]);
        postUpgradeChecks(config);
      });
    });
  });
});
