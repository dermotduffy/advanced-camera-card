import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManagerEngine } from '../../../src/camera-manager/engine';
import { FrigateCamera } from '../../../src/camera-manager/frigate/camera';
import { FrigateEventWatcher } from '../../../src/camera-manager/frigate/event-watcher';
import { getPTZInfo } from '../../../src/camera-manager/frigate/requests';
import { FrigateEventChange } from '../../../src/camera-manager/frigate/types';
import { ActionsExecutor } from '../../../src/card-controller/actions/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { PTZAction } from '../../../src/config/schema/actions/custom/ptz';
import { CameraTriggerEventType } from '../../../src/config/schema/cameras';
import { Entity, EntityRegistryManager } from '../../../src/ha/registry/entity/types';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import { createCameraConfig, createHASS, createRegistryEntity } from '../../test-utils';

vi.mock('../../../src/camera-manager/frigate/requests');

const callEventWatcherCallback = (
  eventWatcher: FrigateEventWatcher,
  event: FrigateEventChange,
  n = 0,
): void => {
  const mock = vi.mocked(eventWatcher.subscribe).mock;
  expect(mock.calls.length).greaterThan(n);
  mock.calls[n][1].callback(event);
};

describe('FrigateCamera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPTZInfo).mockResolvedValue({});
  });

  describe('should initialize config', () => {
    describe('should detect camera name', () => {
      it('without a camera_entity', async () => {
        const config = createCameraConfig();
        const camera = new FrigateCamera(config, mock<CameraManagerEngine>());
        const beforeConfig = { ...config };

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: mock<EntityRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        expect(beforeConfig).toEqual(camera.getConfig());
      });

      it('with a missing camera_entity', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.not_here',
          }),
          mock<CameraManagerEngine>(),
        );
        const entityRegistryManager = new EntityRegistryManagerMock();

        expect(
          async () =>
            await camera.initialize({
              hass: createHASS(),
              entityRegistryManager: entityRegistryManager,
              stateWatcher: mock<StateWatcher>(),
              frigateEventWatcher: mock<FrigateEventWatcher>(),
            }),
        ).rejects.toThrowError(/Could not find camera entity/);
      });

      it('with a valid camera_entity', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.front_door',
          }),
          mock<CameraManagerEngine>(),
        );
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity({
            entity_id: 'camera.front_door',
            unique_id: '8c4e19d258359e82bc0cf9d47b021c46:camera:fnt_dr',
            platform: 'frigate',
          }),
        ]);

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: entityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });
        expect(camera.getConfig().frigate.camera_name).toBe('fnt_dr');
      });

      it('with a camera_entity without camera_name match', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.front_door',
          }),
          mock<CameraManagerEngine>(),
        );
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity({
            entity_id: 'camera.front_door',
            unique_id: '8c4e19d258359e82bc0cf9d47b021c46:WRONG:fnt_dr',
            platform: 'frigate',
          }),
        ]);

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: entityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });
        expect(camera.getConfig().frigate.camera_name).toBeUndefined();
      });

      it('with a camera_entity without platform match', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.front_door',
          }),
          mock<CameraManagerEngine>(),
        );
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity({
            entity_id: 'camera.front_door',
            unique_id: '8c4e19d258359e82bc0cf9d47b021c46:camera:fnt_dr',
            platform: 'something_else',
          }),
        ]);

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: entityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });
        expect(camera.getConfig().frigate.camera_name).toBeUndefined();
      });
    });
  });

  describe('should detect capabilities', () => {
    it('basic non-birdseye', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: {
            camera_name: 'front_door',
          },
        }),
        mock<CameraManagerEngine>(),
      );

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: mock<EntityRegistryManager>(),
        stateWatcher: mock<StateWatcher>(),
        frigateEventWatcher: mock<FrigateEventWatcher>(),
      });
      expect(camera.getCapabilities()?.has('favorite-events')).toBeTruthy();
      expect(camera.getCapabilities()?.has('favorite-recordings')).toBeFalsy();
      expect(camera.getCapabilities()?.has('seek')).toBeTruthy();
      expect(camera.getCapabilities()?.has('clips')).toBeTruthy();
      expect(camera.getCapabilities()?.has('live')).toBeTruthy();
      expect(camera.getCapabilities()?.has('snapshots')).toBeTruthy();
      expect(camera.getCapabilities()?.has('recordings')).toBeTruthy();
      expect(camera.getCapabilities()?.has('trigger')).toBeTruthy();
      expect(vi.mocked(getPTZInfo)).toBeCalled();
    });

    it('basic birdseye', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: {
            camera_name: 'birdseye',
          },
        }),
        mock<CameraManagerEngine>(),
      );

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: mock<EntityRegistryManager>(),
        stateWatcher: mock<StateWatcher>(),
        frigateEventWatcher: mock<FrigateEventWatcher>(),
      });
      expect(camera.getCapabilities()?.has('favorite-events')).toBeFalsy();
      expect(camera.getCapabilities()?.has('favorite-recordings')).toBeFalsy();
      expect(camera.getCapabilities()?.has('seek')).toBeFalsy();
      expect(camera.getCapabilities()?.has('clips')).toBeFalsy();
      expect(camera.getCapabilities()?.has('live')).toBeTruthy();
      expect(camera.getCapabilities()?.has('snapshots')).toBeFalsy();
      expect(camera.getCapabilities()?.has('recordings')).toBeFalsy();
      expect(camera.getCapabilities()?.has('trigger')).toBeTruthy();
      expect(vi.mocked(getPTZInfo)).not.toBeCalled();
    });

    describe('with ptz', () => {
      it('when getPTZInfo call fails', async () => {
        const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        vi.mocked(getPTZInfo).mockRejectedValue(new Error());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: mock<EntityRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        expect(camera.getCapabilities()?.has('ptz')).toBeFalsy();
        expect(camera.getCapabilities()?.hasPTZCapability()).toBeFalsy();
        expect(consoleSpy).toBeCalled();
      });

      it('when getPTZInfo call succeeds with continuous motion', async () => {
        vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        vi.mocked(getPTZInfo).mockResolvedValue({
          features: ['pt', 'zoom'],
          name: 'front_door',
          presets: ['preset01'],
        });

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: mock<EntityRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });
        expect(camera.getCapabilities()?.has('ptz')).toBeTruthy();
        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          left: ['continuous'],
          right: ['continuous'],
          up: ['continuous'],
          down: ['continuous'],
          zoomIn: ['continuous'],
          zoomOut: ['continuous'],
          presets: ['preset01'],
        });
        expect(camera.getCapabilities()?.hasPTZCapability()).toBeTruthy();
      });

      it('when getPTZInfo call succeeds with relative motion', async () => {
        vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        vi.mocked(getPTZInfo).mockResolvedValue({
          features: ['pt-r', 'zoom-r'],
          name: 'front_door',
          presets: ['preset01'],
        });

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: mock<EntityRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });
        expect(camera.getCapabilities()?.has('ptz')).toBeTruthy();
        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          left: [],
          right: [],
          up: [],
          down: [],
          zoomIn: [],
          zoomOut: [],
          presets: ['preset01'],
        });
        expect(camera.getCapabilities()?.hasPTZCapability()).toBeTruthy();
      });
    });
  });

  describe('should handle events', () => {
    it('should subscribe', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: {
            client_id: 'CLIENT_ID',
            camera_name: 'CAMERA',
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();

      const eventWatcher = mock<FrigateEventWatcher>();
      await camera.initialize({
        hass: hass,
        entityRegistryManager: mock<EntityRegistryManager>(),
        stateWatcher: mock<StateWatcher>(),
        frigateEventWatcher: eventWatcher,
      });
      expect(eventWatcher.subscribe).toBeCalledWith(
        hass,
        expect.objectContaining({
          instanceID: 'CLIENT_ID',
        }),
      );
    });

    it('should not subscribe with no trigger events', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: {
            client_id: 'CLIENT_ID',
            camera_name: 'CAMERA',
          },
          triggers: {
            events: [],
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();

      const eventWatcher = mock<FrigateEventWatcher>();
      await camera.initialize({
        hass: hass,
        entityRegistryManager: mock<EntityRegistryManager>(),
        stateWatcher: mock<StateWatcher>(),
        frigateEventWatcher: eventWatcher,
      });
      expect(eventWatcher.subscribe).not.toBeCalled();
    });

    it('should not subscribe without trigger capability', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: {
            client_id: 'CLIENT_ID',
            camera_name: 'CAMERA',
          },
          capabilities: {
            disable: ['trigger'],
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();

      const eventWatcher = mock<FrigateEventWatcher>();
      await camera.initialize({
        hass: hass,
        entityRegistryManager: mock<EntityRegistryManager>(),
        stateWatcher: mock<StateWatcher>(),
        frigateEventWatcher: eventWatcher,
      });
      expect(eventWatcher.subscribe).not.toBeCalled();
    });

    it('should not subscribe with no camera name', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: {
            client_id: 'CLIENT_ID',
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();

      const eventWatcher = mock<FrigateEventWatcher>();
      await camera.initialize({
        hass: hass,
        entityRegistryManager: mock<EntityRegistryManager>(),
        stateWatcher: mock<StateWatcher>(),
        frigateEventWatcher: eventWatcher,
      });
      expect(eventWatcher.subscribe).not.toBeCalled();
    });

    it('should unsubscribe on destroy', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: { camera_name: 'front_door' },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();
      const unsubscribeCallback = vi.fn();
      vi.mocked(hass.connection.subscribeMessage).mockResolvedValue(unsubscribeCallback);

      const eventWatcher = mock<FrigateEventWatcher>();
      await camera.initialize({
        hass: hass,
        entityRegistryManager: mock<EntityRegistryManager>(),
        stateWatcher: mock<StateWatcher>(),
        frigateEventWatcher: eventWatcher,
      });
      expect(eventWatcher.unsubscribe).not.toBeCalled();

      await camera.destroy();
      expect(eventWatcher.unsubscribe).toBeCalled();
    });

    describe('should call handler correctly', () => {
      describe('should handle event type correctly', () => {
        it.each([
          [
            ['events' as const, 'snapshots' as const, 'clips' as const],
            false,
            false,
            true,
          ],
          [
            ['events' as const, 'snapshots' as const, 'clips' as const],
            false,
            true,
            true,
          ],
          [
            ['events' as const, 'snapshots' as const, 'clips' as const],
            true,
            false,
            true,
          ],
          [
            ['events' as const, 'snapshots' as const, 'clips' as const],
            true,
            true,
            true,
          ],

          [['events' as const, 'snapshots' as const], false, false, true],
          [['events' as const, 'snapshots' as const], false, true, true],
          [['events' as const, 'snapshots' as const], true, false, true],
          [['events' as const, 'snapshots' as const], true, true, true],

          [['events' as const, 'clips' as const], false, false, true],
          [['events' as const, 'clips' as const], false, true, true],
          [['events' as const, 'clips' as const], true, false, true],
          [['events' as const, 'clips' as const], true, true, true],

          [['events' as const], false, false, true],
          [['events' as const], false, true, true],
          [['events' as const], true, false, true],
          [['events' as const], true, true, true],

          [['snapshots' as const, 'clips' as const], false, false, false],
          [['snapshots' as const, 'clips' as const], false, true, true],
          [['snapshots' as const, 'clips' as const], true, false, true],
          [['snapshots' as const, 'clips' as const], true, true, true],

          [['snapshots' as const], false, false, false],
          [['snapshots' as const], false, true, false],
          [['snapshots' as const], true, false, true],
          [['snapshots' as const], true, true, true],

          [['clips' as const], false, false, false],
          [['clips' as const], false, true, true],
          [['clips' as const], true, false, false],
          [['clips' as const], true, true, true],
        ])(
          'with events %s when snapshot %s and clip %s',
          async (
            events: CameraTriggerEventType[],
            hasSnapshot: boolean,
            hasClip: boolean,
            call: boolean,
          ) => {
            const eventCallback = vi.fn();
            const camera = new FrigateCamera(
              createCameraConfig({
                id: 'CAMERA_1',
                frigate: {
                  camera_name: 'camera.front_door',
                },
                triggers: {
                  events: events,
                },
              }),
              mock<CameraManagerEngine>(),
              {
                eventCallback: eventCallback,
              },
            );

            const hass = createHASS();
            const eventWatcher = mock<FrigateEventWatcher>();
            await camera.initialize({
              hass: hass,
              entityRegistryManager: mock<EntityRegistryManager>(),
              stateWatcher: mock<StateWatcher>(),
              frigateEventWatcher: eventWatcher,
            });

            callEventWatcherCallback(eventWatcher, {
              type: 'new',
              before: {
                camera: 'camera.front_door',
                snapshot: null,
                has_clip: false,
                has_snapshot: false,
                label: 'person',
                current_zones: [],
              },
              after: {
                camera: 'camera.front_door',
                snapshot: null,
                has_clip: hasClip,
                has_snapshot: hasSnapshot,
                label: 'person',
                current_zones: [],
              },
            });

            if (call) {
              expect(eventCallback).toBeCalledWith({
                type: 'new',
                cameraID: 'CAMERA_1',
                clip: hasClip && events.includes('clips'),
                snapshot: hasSnapshot && events.includes('snapshots'),
                fidelity: 'high',
              });
            } else {
              expect(eventCallback).not.toBeCalled();
            }
          },
        );
      });

      describe('should handle zones correctly', () => {
        it.each([
          ['has no zone', [], false],
          ['has mismatched zone', ['fence'], false],
          ['has matching zone', ['front_steps'], true],
        ])('%s', async (_name: string, zones: string[], call: boolean) => {
          const eventCallback = vi.fn();
          const camera = new FrigateCamera(
            createCameraConfig({
              id: 'CAMERA_1',
              frigate: {
                camera_name: 'camera.front_door',
                zones: ['front_steps'],
              },
            }),
            mock<CameraManagerEngine>(),
            {
              eventCallback: eventCallback,
            },
          );

          const hass = createHASS();
          const eventWatcher = mock<FrigateEventWatcher>();
          await camera.initialize({
            hass: hass,
            entityRegistryManager: mock<EntityRegistryManager>(),
            stateWatcher: mock<StateWatcher>(),
            frigateEventWatcher: eventWatcher,
          });

          callEventWatcherCallback(eventWatcher, {
            type: 'new',
            before: {
              camera: 'camera.front_door',
              snapshot: null,
              has_clip: false,
              has_snapshot: false,
              label: 'person',
              current_zones: [],
            },
            after: {
              camera: 'camera.front_door',
              snapshot: null,
              has_clip: false,
              has_snapshot: true,
              label: 'person',
              current_zones: zones,
            },
          });

          expect(eventCallback).toHaveBeenCalledTimes(call ? 1 : 0);
        });
      });

      describe('should handle labels correctly', () => {
        it.each([
          ['has mismatched label', 'car', false],
          ['has matching label', 'person', true],
        ])('%s', async (_name: string, label: string, call: boolean) => {
          const eventCallback = vi.fn();
          const camera = new FrigateCamera(
            createCameraConfig({
              id: 'CAMERA_1',
              frigate: {
                camera_name: 'camera.front_door',
                labels: ['person'],
              },
            }),
            mock<CameraManagerEngine>(),
            {
              eventCallback: eventCallback,
            },
          );

          const hass = createHASS();
          const eventWatcher = mock<FrigateEventWatcher>();
          await camera.initialize({
            hass: hass,
            entityRegistryManager: mock<EntityRegistryManager>(),
            stateWatcher: mock<StateWatcher>(),
            frigateEventWatcher: eventWatcher,
          });

          callEventWatcherCallback(eventWatcher, {
            type: 'new',
            before: {
              camera: 'camera.front_door',
              snapshot: null,
              has_clip: false,
              has_snapshot: false,
              // Even new events appear to have the event label in the
              // 'before' dictionary.
              label: label,
              current_zones: [],
            },
            after: {
              camera: 'camera.front_door',
              snapshot: null,
              has_clip: false,
              has_snapshot: true,
              label: label,
              current_zones: [],
            },
          });

          expect(eventCallback).toHaveBeenCalledTimes(call ? 1 : 0);
        });
      });
    });
  });

  describe('should handle triggers', () => {
    const cameraEntity: Partial<Entity> = {
      config_entry_id: 'config_entry_id',
      entity_id: 'camera.front_door',
    };

    const occupancySensorEntityAll: Partial<Entity> = {
      config_entry_id: 'config_entry_id',
      disabled_by: null,
      entity_id: 'binary_sensor.foo',
      unique_id: '8c4e19d258359e82bc0cf9d47b021c46:occupancy_sensor:front_door_all',
    };

    const motionSensorEntity: Partial<Entity> = {
      config_entry_id: 'config_entry_id',
      disabled_by: null,
      entity_id: 'binary_sensor.foo',
      unique_id: '8c4e19d258359e82bc0cf9d47b021c46:motion_sensor:front_door',
    };

    describe('should detect motion sensor', () => {
      it('without a camera name', async () => {
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity(cameraEntity),
          createRegistryEntity(motionSensorEntity),
        ]);
        const camera = new FrigateCamera(
          createCameraConfig({
            triggers: {
              motion: true,
            },
          }),
          mock<CameraManagerEngine>(),
        );

        const hass = createHASS();
        await camera.initialize({
          hass: hass,
          entityRegistryManager: entityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        expect(camera.getConfig().triggers.entities).toEqual([]);
      });

      it('with camera entity and name', async () => {
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity(cameraEntity),
          createRegistryEntity(motionSensorEntity),
        ]);
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.front_door',
            frigate: {
              camera_name: 'front_door',
            },
            triggers: {
              motion: true,
            },
          }),
          mock<CameraManagerEngine>(),
        );

        const hass = createHASS();
        await camera.initialize({
          hass: hass,
          entityRegistryManager: entityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        expect(camera.getConfig().triggers.entities).toEqual(['binary_sensor.foo']);
      });

      it('without matching entity', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              camera_name: 'front_door',
            },
            triggers: {
              motion: true,
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const hass = createHASS();
        await camera.initialize({
          hass: hass,
          entityRegistryManager: new EntityRegistryManagerMock(),
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        expect(camera.getConfig().triggers.entities).toEqual([]);
      });
    });

    describe('should detect occupancy sensor', () => {
      it('without a camera name', async () => {
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity(cameraEntity),
          createRegistryEntity(occupancySensorEntityAll),
        ]);
        const camera = new FrigateCamera(
          createCameraConfig({
            triggers: {
              occupancy: true,
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const hass = createHASS();
        await camera.initialize({
          hass: hass,
          entityRegistryManager: entityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        expect(camera.getConfig().triggers.entities).toEqual([]);
      });

      it('without a camera name but with occupancy trigger', async () => {
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity(cameraEntity),
          createRegistryEntity(occupancySensorEntityAll),
        ]);
        const camera = new FrigateCamera(
          createCameraConfig({
            triggers: {
              occupancy: true,
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const hass = createHASS();
        await camera.initialize({
          hass: hass,
          entityRegistryManager: entityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        expect(camera.getConfig().triggers.entities).toEqual([]);
      });

      it('without matching entity', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              camera_name: 'front_door',
            },
            triggers: {
              occupancy: true,
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const hass = createHASS();
        await camera.initialize({
          hass: hass,
          entityRegistryManager: new EntityRegistryManagerMock(),
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        expect(camera.getConfig().triggers.entities).toEqual([]);
      });

      it('with zones', async () => {
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity(cameraEntity),
          createRegistryEntity({
            ...occupancySensorEntityAll,
            unique_id: '8c4e19d258359e82bc0cf9d47b021c46:occupancy_sensor:zone_all',
          }),
        ]);
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.front_door',
            frigate: {
              camera_name: 'front_door',
              zones: ['zone'],
            },
            triggers: {
              occupancy: true,
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const hass = createHASS();
        await camera.initialize({
          hass: hass,
          entityRegistryManager: entityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        expect(camera.getConfig().triggers.entities).toEqual(['binary_sensor.foo']);
      });

      it('with labels', async () => {
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity(cameraEntity),
          createRegistryEntity({
            ...occupancySensorEntityAll,
            unique_id:
              '8c4e19d258359e82bc0cf9d47b021c46:occupancy_sensor:front_door_car',
          }),
        ]);

        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.front_door',
            frigate: {
              camera_name: 'front_door',
              labels: ['car'],
            },
            triggers: {
              occupancy: true,
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const hass = createHASS();
        await camera.initialize({
          hass: hass,
          entityRegistryManager: entityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        expect(camera.getConfig().triggers.entities).toEqual(['binary_sensor.foo']);
      });
    });

    describe('should execute PTZ action', () => {
      it('should ignore preset action without a preset', async () => {
        const camera = new FrigateCamera(
          createCameraConfig(),
          mock<CameraManagerEngine>(),
        );

        const hass = createHASS();
        await camera.initialize({
          hass: hass,
          entityRegistryManager: mock<EntityRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        const executor = mock<ActionsExecutor>();
        await camera.executePTZAction(executor, 'preset');

        expect(executor.executeActions).not.toBeCalled();
      });

      it('should ignore actions with configured action', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.office_frigate',
            ptz: {
              actions_left_start: {
                action: 'perform-action',
                perform_action: 'button.press',
                target: {
                  entity_id: 'button.foo',
                },
              },
            },
          }),
          mock<CameraManagerEngine>(),
        );

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            createRegistryEntity({ entity_id: 'camera.office_frigate' }),
          ]),
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        const executor = mock<ActionsExecutor>();
        await camera.executePTZAction(executor, 'left', { phase: 'start' });

        expect(executor.executeActions).toBeCalledTimes(1);
        expect(executor.executeActions).toHaveBeenLastCalledWith({
          actions: {
            action: 'perform-action',
            perform_action: 'button.press',
            target: {
              entity_id: 'button.foo',
            },
          },
        });
      });

      it.each([
        ['left' as const],
        ['right' as const],
        ['up' as const],
        ['down' as const],
      ])('should execute action %s', async (action: PTZAction) => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.office_frigate',
          }),
          mock<CameraManagerEngine>(),
        );

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            createRegistryEntity({ entity_id: 'camera.office_frigate' }),
          ]),
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, action, { phase: 'start' });
        expect(executor.executeActions).toHaveBeenLastCalledWith({
          actions: {
            action: 'perform-action',
            data: {
              action: 'move',
              argument: action,
            },
            perform_action: 'frigate.ptz',
            target: {
              entity_id: 'camera.office_frigate',
            },
          },
        });

        await camera.executePTZAction(executor, action, { phase: 'stop' });
        expect(executor.executeActions).toHaveBeenLastCalledWith({
          actions: {
            action: 'perform-action',
            data: {
              action: 'stop',
            },
            perform_action: 'frigate.ptz',
            target: {
              entity_id: 'camera.office_frigate',
            },
          },
        });
      });

      it.each([
        ['zoom_in' as const, 'in' as const],
        ['zoom_out' as const, 'out' as const],
      ])('should execute action %s', async (action: PTZAction, zoom: 'in' | 'out') => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.office_frigate',
          }),
          mock<CameraManagerEngine>(),
        );

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            createRegistryEntity({ entity_id: 'camera.office_frigate' }),
          ]),
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, action, { phase: 'start' });
        expect(executor.executeActions).toHaveBeenLastCalledWith({
          actions: {
            action: 'perform-action',
            data: {
              action: 'zoom',
              argument: zoom,
            },
            perform_action: 'frigate.ptz',
            target: {
              entity_id: 'camera.office_frigate',
            },
          },
        });
      });

      it('should execute preset', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.office_frigate',
          }),
          mock<CameraManagerEngine>(),
        );

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            createRegistryEntity({ entity_id: 'camera.office_frigate' }),
          ]),
          stateWatcher: mock<StateWatcher>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
        });

        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'preset', { preset: 'foo' });
        expect(executor.executeActions).toHaveBeenLastCalledWith({
          actions: {
            action: 'perform-action',
            data: {
              action: 'preset',
              argument: 'foo',
            },
            perform_action: 'frigate.ptz',
            target: {
              entity_id: 'camera.office_frigate',
            },
          },
        });
      });
    });
  });
});
