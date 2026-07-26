import { format } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CameraManagerEngine } from '../../../src/camera-manager/engine';
import { FrigateCamera } from '../../../src/camera-manager/frigate/camera';
import {
  FrigateEventViewMedia,
  FrigateRecordingViewMedia,
} from '../../../src/camera-manager/frigate/media';
import { getPTZInfo } from '../../../src/camera-manager/frigate/requests';
import {
  eventSchema,
  type FrigateEventChange,
  type FrigateReviewChange,
} from '../../../src/camera-manager/frigate/types';
import type {
  FrigateEventWatcher,
  FrigateReviewWatcher,
} from '../../../src/camera-manager/frigate/watcher';
import type { ActionsExecutor } from '../../../src/card-controller/actions/types';
import type { PTZAction } from '../../../src/config/schema/actions/custom/ptz';
import type { CameraTriggerMediaEventType } from '../../../src/config/schema/cameras';
import type {
  Entity,
  EntityRegistryManager,
} from '../../../src/ha/registry/entity/types';
import { ViewMediaType } from '../../../src/view/item';
import { createCameraConfig } from '../../config/test-utils';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import {
  createHASS,
  createHASSManager,
  createRegistryEntity,
  createStateEntity,
} from '../../test-utils';
import { createCapabilities } from '../test-utils';

vi.mock('../../../src/camera-manager/frigate/requests');

const callEventWatcherCallback = (
  eventWatcher: FrigateEventWatcher,
  event: FrigateEventChange,
  n = 0,
): void => {
  const mock = vi.mocked(eventWatcher.subscribe).mock;
  expect(mock.calls.length).greaterThan(n);
  mock.calls[n][0].callback(event);
};

const callReviewWatcherCallback = (
  reviewWatcher: FrigateReviewWatcher,
  review: FrigateReviewChange,
  n = 0,
): void => {
  const mock = vi.mocked(reviewWatcher.subscribe).mock;
  expect(mock.calls.length).greaterThan(n);
  mock.calls[n][0].callback(review);
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
          hassManager: createHASSManager(),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
              hassManager: createHASSManager(),
              entityRegistryManager: entityRegistryManager,
              frigateEventWatcher: mock<FrigateEventWatcher>(),
              frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager(),
          entityRegistryManager: entityRegistryManager,
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager(),
          entityRegistryManager: entityRegistryManager,
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager(),
          entityRegistryManager: entityRegistryManager,
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
        });
        expect(camera.getConfig().frigate.camera_name).toBeUndefined();
      });
    });

    describe('should resolve client_id', () => {
      it('from a non-default value on the entity attributes', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.front_door',
            frigate: { camera_name: 'front_door' },
          }),
          mock<CameraManagerEngine>(),
        );
        await camera.initialize({
          hassManager: createHASSManager({
            hass: createHASS({
              'camera.front_door': createStateEntity({
                entity_id: 'camera.front_door',
                attributes: { client_id: 'remote_frigate' },
              }),
            }),
          }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
        });
        expect(camera.getConfig().frigate.client_id).toBe('remote_frigate');
      });

      it('falls back to "frigate" when the entity attribute is missing', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.front_door',
            frigate: { camera_name: 'front_door' },
          }),
          mock<CameraManagerEngine>(),
        );
        await camera.initialize({
          hassManager: createHASSManager({
            hass: createHASS({
              'camera.front_door': createStateEntity({
                entity_id: 'camera.front_door',
                attributes: {},
              }),
            }),
          }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
        });
        expect(camera.getConfig().frigate.client_id).toBe('frigate');
      });

      it('falls back to "frigate" when no camera_entity is configured', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: { camera_name: 'front_door' },
          }),
          mock<CameraManagerEngine>(),
        );
        await camera.initialize({
          hassManager: createHASSManager(),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
        });
        expect(camera.getConfig().frigate.client_id).toBe('frigate');
      });

      it('preserves an explicit value', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.front_door',
            frigate: { camera_name: 'front_door', client_id: 'remote_x' },
          }),
          mock<CameraManagerEngine>(),
        );
        await camera.initialize({
          hassManager: createHASSManager({
            hass: createHASS({
              'camera.front_door': createStateEntity({
                entity_id: 'camera.front_door',
                attributes: { client_id: 'something_else' },
              }),
            }),
          }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
        });
        expect(camera.getConfig().frigate.client_id).toBe('remote_x');
      });

      it('falls back to "frigate" when the camera entity is unavailable', async () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            camera_entity: 'camera.front_door',
            frigate: { camera_name: 'front_door' },
          }),
          mock<CameraManagerEngine>(),
        );
        await camera.initialize({
          hassManager: createHASSManager({
            hass: createHASS({
              'camera.front_door': createStateEntity({
                entity_id: 'camera.front_door',
                state: 'unavailable',
                attributes: {},
              }),
            }),
          }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
        });
        expect(camera.getConfig().frigate.client_id).toBe('frigate');
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
        hassManager: createHASSManager(),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: mock<FrigateEventWatcher>(),
        frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
        hassManager: createHASSManager(),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: mock<FrigateEventWatcher>(),
        frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager(),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager(),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager(),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
        });
        expect(camera.getCapabilities()?.has('ptz')).toBeTruthy();
        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          // pt-r and zoom-r don't match 'pt' and 'zoom', so only presets
          presets: ['preset01'],
        });
        expect(camera.getCapabilities()?.hasPTZCapability()).toBeTruthy();
      });

      it('when getPTZInfo returns only zoom capabilities', async () => {
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
          features: ['zoom'],
          name: 'front_door',
          presets: [],
        });

        await camera.initialize({
          hassManager: createHASSManager(),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
        });

        expect(camera.getCapabilities()?.has('ptz')).toBeTruthy();

        // Should only have zoom capabilities, not empty pan/tilt arrays
        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          zoomIn: ['continuous'],
          zoomOut: ['continuous'],
        });

        expect(camera.getCapabilities()?.hasPTZCapability()).toBeTruthy();
      });

      it('when getPTZInfo returns only pan/tilt capabilities', async () => {
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
          features: ['pt'],
          name: 'front_door',
          presets: [],
        });

        await camera.initialize({
          hassManager: createHASSManager(),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
        });
        expect(camera.getCapabilities()?.has('ptz')).toBeTruthy();

        // Should only have pan/tilt capabilities, not empty zoom arrays
        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          left: ['continuous'],
          right: ['continuous'],
          up: ['continuous'],
          down: ['continuous'],
        });

        expect(camera.getCapabilities()?.hasPTZCapability()).toBeTruthy();
      });
    });
  });

  describe('getEndpoints', () => {
    describe('getUIEndpoint', () => {
      it('should return null when no frigate URL is set', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              url: '',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        expect(camera.getEndpoints()).toBeNull();
      });

      it('should return frigate URL when no camera name is set', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              url: 'http://frigate',
              camera_name: '',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        expect(camera.getEndpoints({ view: 'live' })?.ui).toEqual({
          endpoint: 'http://frigate',
        });
      });

      it('should return camera URL for live view', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              url: 'http://frigate',
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        expect(camera.getEndpoints({ view: 'live' })?.ui).toEqual({
          endpoint: 'http://frigate/#front_door',
        });
      });

      it('should return events URL for clip media', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              url: 'http://frigate',
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const event = eventSchema.parse({
          camera: 'front_door',
          id: 'event-id',
          label: 'person',
          start_time: 100,
          end_time: 200,
          has_clip: true,
          has_snapshot: true,
          retain_indefinitely: false,
          false_positive: false,
          sub_label: '',
          top_score: 0.8,
          zones: [],
        });
        const media = new FrigateEventViewMedia(
          ViewMediaType.Clip,
          'front_door',
          event,
          'content-id',
          'thumbnail',
        );

        expect(camera.getEndpoints({ view: 'media', media })?.ui).toEqual({
          endpoint: 'http://frigate/events?camera=front_door',
        });
      });

      it('should return events URL for snapshot media', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              url: 'http://frigate',
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const event = eventSchema.parse({
          camera: 'front_door',
          id: 'event-id',
          label: 'person',
          start_time: 100,
          end_time: 200,
          has_clip: true,
          has_snapshot: true,
          retain_indefinitely: false,
          false_positive: false,
          sub_label: '',
          top_score: 0.8,
          zones: [],
        });
        const media = new FrigateEventViewMedia(
          ViewMediaType.Snapshot,
          'front_door',
          event,
          'content-id',
          'thumbnail',
        );

        expect(camera.getEndpoints({ view: 'media', media })?.ui).toEqual({
          endpoint: 'http://frigate/events?camera=front_door',
        });
      });

      it('should return recordings URL with time for recording media with startTime', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              url: 'http://frigate',
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const media = new FrigateRecordingViewMedia(
          ViewMediaType.Recording,
          'front_door',
          {
            cameraID: 'front_door',
            startTime: new Date('2023-01-01T10:00:00'),
            endTime: new Date('2023-01-01T11:00:00'),
            events: 0,
          },
          'recording-id',
          'content-id',
          'title',
        );

        expect(camera.getEndpoints({ view: 'media', media })?.ui).toEqual({
          endpoint:
            'http://frigate/recording/front_door/' +
            format(media.getStartTime(), 'yyyy-MM-dd/HH'),
        });
      });

      it('should return recordings URL without time for recording media without startTime', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              url: 'http://frigate',
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        // Create a media object where getStartTime returns null
        const media = new FrigateRecordingViewMedia(
          ViewMediaType.Recording,
          'front_door',
          {
            cameraID: 'front_door',
            // Forced null for test
            startTime: null as unknown as Date,
            endTime: new Date('2023-01-01T11:00:00'),
            events: 0,
          },
          'recording-id',
          'content-id',
          'title',
        );

        expect(camera.getEndpoints({ view: 'media', media })?.ui).toEqual({
          endpoint: 'http://frigate/recording/front_door',
        });
      });

      it('should return events URL for clip/clips/snapshots/snapshot views', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              url: 'http://frigate',
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        expect(camera.getEndpoints({ view: 'clip' })?.ui?.endpoint).toBe(
          'http://frigate/events?camera=front_door',
        );
        expect(camera.getEndpoints({ view: 'clips' })?.ui?.endpoint).toBe(
          'http://frigate/events?camera=front_door',
        );
        expect(camera.getEndpoints({ view: 'snapshots' })?.ui?.endpoint).toBe(
          'http://frigate/events?camera=front_door',
        );
        expect(camera.getEndpoints({ view: 'snapshot' })?.ui?.endpoint).toBe(
          'http://frigate/events?camera=front_door',
        );
      });

      it('should return recordings URL for recording/recordings views', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              url: 'http://frigate',
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        expect(camera.getEndpoints({ view: 'recording' })?.ui?.endpoint).toBe(
          'http://frigate/recording/front_door',
        );
        expect(camera.getEndpoints({ view: 'recordings' })?.ui?.endpoint).toBe(
          'http://frigate/recording/front_door',
        );
      });

      it('should return camera URL as default fallback', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              url: 'http://frigate',
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        expect(camera.getEndpoints({ view: 'timeline' })?.ui).toEqual({
          endpoint: 'http://frigate/#front_door',
        });
      });
    });

    describe('getGo2RTCStreamEndpoint', () => {
      it('should return default frigate go2rtc paths', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              client_id: 'frigate',
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const endpoints = camera.getEndpoints();
        expect(endpoints?.go2rtc).toEqual({
          endpoint: '/api/frigate/frigate/mse/api/ws?src=front_door',
          sign: true,
        });
      });
    });

    describe('getJSMPEGEndpoint', () => {
      it('should return default frigate jsmpeg path', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              client_id: 'frigate',
              camera_name: 'front_door',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const endpoints = camera.getEndpoints();
        expect(endpoints?.jsmpeg).toEqual({
          endpoint: '/api/frigate/frigate/jsmpeg/front_door',
          sign: true,
        });
      });

      it('should return null if no camera name is set', () => {
        const camera = new FrigateCamera(
          createCameraConfig({
            frigate: {
              camera_name: '',
            },
          }),
          mock<CameraManagerEngine>(),
        );
        const endpoints = camera.getEndpoints();
        expect(endpoints?.jsmpeg).toBeUndefined();
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
          triggers: {
            media_events: ['events'],
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();

      const eventWatcher = mock<FrigateEventWatcher>();
      await camera.initialize({
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: eventWatcher,
        frigateReviewWatcher: mock<FrigateReviewWatcher>(),
      });
      expect(eventWatcher.subscribe).toBeCalledWith(
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
            media_events: [],
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();

      const eventWatcher = mock<FrigateEventWatcher>();
      await camera.initialize({
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: eventWatcher,
        frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: eventWatcher,
        frigateReviewWatcher: mock<FrigateReviewWatcher>(),
      });
      expect(eventWatcher.subscribe).not.toBeCalled();
    });

    it('should not subscribe with no camera name', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: {
            client_id: 'CLIENT_ID',
          },
          triggers: {
            media_events: ['events'],
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();

      const eventWatcher = mock<FrigateEventWatcher>();
      await camera.initialize({
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: eventWatcher,
        frigateReviewWatcher: mock<FrigateReviewWatcher>(),
      });
      expect(eventWatcher.subscribe).not.toBeCalled();
    });

    it('should unsubscribe on destroy', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: { camera_name: 'front_door' },
          triggers: {
            media_events: ['events'],
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();
      const unsubscribeCallback = vi.fn();
      vi.mocked(hass.connection.subscribeMessage).mockResolvedValue(unsubscribeCallback);

      const eventWatcher = mock<FrigateEventWatcher>();
      await camera.initialize({
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: eventWatcher,
        frigateReviewWatcher: mock<FrigateReviewWatcher>(),
      });
      expect(eventWatcher.unsubscribe).not.toBeCalled();

      await camera.destroy();
      expect(eventWatcher.unsubscribe).toBeCalled();
    });

    it('should not subscribe when destroyed while base initialization is pending', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          camera_entity: 'camera.front_door',
          frigate: { client_id: 'CLIENT_ID', camera_name: 'front_door' },
          triggers: {
            media_events: ['events'],
            reviews: { severities: ['high'] },
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();
      const eventWatcher = mock<FrigateEventWatcher>();
      const reviewWatcher = mock<FrigateReviewWatcher>();

      // Pend base initialization on entity resolution so destroy() can flip
      // `_destroyed` before initialize() reaches the subscribe calls.
      let resolveEntity: () => void = () => {};
      const entityRegistryManager = mock<EntityRegistryManager>();
      vi.mocked(entityRegistryManager.getEntity).mockReturnValue(
        new Promise((resolve) => {
          resolveEntity = () => resolve(createRegistryEntity());
        }),
      );

      const initializePromise = camera.initialize({
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: entityRegistryManager,
        frigateEventWatcher: eventWatcher,
        frigateReviewWatcher: reviewWatcher,
        capabilityOptions: { capabilities: createCapabilities({ trigger: true }) },
      });
      await vi.waitFor(() => expect(entityRegistryManager.getEntity).toBeCalled());

      await camera.destroy();

      // `_destroyed` short-circuits initialize() after the pending await, so
      // neither watcher is ever subscribed.
      expect(eventWatcher.subscribe).not.toBeCalled();
      expect(reviewWatcher.subscribe).not.toBeCalled();

      resolveEntity();
      await initializePromise;

      expect(eventWatcher.subscribe).not.toBeCalled();
      expect(eventWatcher.unsubscribe).not.toBeCalled();
      expect(reviewWatcher.subscribe).not.toBeCalled();
      expect(reviewWatcher.unsubscribe).not.toBeCalled();
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
            events: CameraTriggerMediaEventType[],
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
                  media_events: events,
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
              hassManager: createHASSManager({ hass }),
              entityRegistryManager: mock<EntityRegistryManager>(),
              frigateEventWatcher: eventWatcher,
              frigateReviewWatcher: mock<FrigateReviewWatcher>(),
            });

            callEventWatcherCallback(eventWatcher, {
              type: 'new',
              before: {
                id: 'event-1',
                camera: 'camera.front_door',
                snapshot: null,
                has_clip: false,
                has_snapshot: false,
                label: 'person',
                current_zones: [],
              },
              after: {
                id: 'event-1',
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
                id: 'event-1',
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

      describe('should always forward end events to clear the trigger', () => {
        it.each([
          ['with media still present', true, ['front_steps']],
          ['with no media present at end', false, ['front_steps']],
          ['even after the object left the configured zone', true, []],
        ])('%s', async (_name: string, hasClip: boolean, currentZones: string[]) => {
          const eventCallback = vi.fn();
          const camera = new FrigateCamera(
            createCameraConfig({
              id: 'CAMERA_1',
              frigate: {
                camera_name: 'camera.front_door',
                zones: ['front_steps'],
              },
              triggers: {
                media_events: ['clips'],
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
            hassManager: createHASSManager({ hass }),
            entityRegistryManager: mock<EntityRegistryManager>(),
            frigateEventWatcher: eventWatcher,
            frigateReviewWatcher: mock<FrigateReviewWatcher>(),
          });

          // An 'end' clears the trigger regardless of the start criteria: the
          // media may be unchanged or absent, and the object may have left the
          // zone by now.
          callEventWatcherCallback(eventWatcher, {
            type: 'end',
            before: {
              id: 'event-1',
              camera: 'camera.front_door',
              snapshot: null,
              has_clip: hasClip,
              has_snapshot: false,
              label: 'person',
              current_zones: currentZones,
            },
            after: {
              id: 'event-1',
              camera: 'camera.front_door',
              snapshot: null,
              has_clip: hasClip,
              has_snapshot: false,
              label: 'person',
              current_zones: currentZones,
            },
          });

          expect(eventCallback).toBeCalledWith({
            type: 'end',
            cameraID: 'CAMERA_1',
            id: 'event-1',
            clip: false,
            snapshot: false,
            fidelity: 'high',
          });
        });
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
              triggers: {
                media_events: ['events'],
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
            hassManager: createHASSManager({ hass }),
            entityRegistryManager: mock<EntityRegistryManager>(),
            frigateEventWatcher: eventWatcher,
            frigateReviewWatcher: mock<FrigateReviewWatcher>(),
          });

          callEventWatcherCallback(eventWatcher, {
            type: 'new',
            before: {
              id: 'event-1',
              camera: 'camera.front_door',
              snapshot: null,
              has_clip: false,
              has_snapshot: false,
              label: 'person',
              current_zones: [],
            },
            after: {
              id: 'event-1',
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
              triggers: {
                media_events: ['events'],
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
            hassManager: createHASSManager({ hass }),
            entityRegistryManager: mock<EntityRegistryManager>(),
            frigateEventWatcher: eventWatcher,
            frigateReviewWatcher: mock<FrigateReviewWatcher>(),
          });

          callEventWatcherCallback(eventWatcher, {
            type: 'new',
            before: {
              id: 'event-1',
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
              id: 'event-1',
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

      it('should ignore events when camera ID is not set', async () => {
        const eventCallback = vi.fn();
        const camera = new FrigateCamera(
          createCameraConfig({
            // Note: No 'id' is set here
            frigate: {
              camera_name: 'camera.front_door',
            },
            triggers: {
              media_events: ['events'],
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
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: eventWatcher,
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
        });

        callEventWatcherCallback(eventWatcher, {
          type: 'new',
          before: {
            id: 'event-1',
            camera: 'camera.front_door',
            snapshot: null,
            has_clip: false,
            has_snapshot: false,
            label: 'person',
            current_zones: [],
          },
          after: {
            id: 'event-1',
            camera: 'camera.front_door',
            snapshot: null,
            has_clip: false,
            has_snapshot: true,
            label: 'person',
            current_zones: [],
          },
        });

        expect(eventCallback).not.toHaveBeenCalled();
      });
    });
  });
  describe('should handle reviews', () => {
    it('should subscribe to reviews', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: {
            client_id: 'CLIENT_ID',
            camera_name: 'CAMERA',
          },
          triggers: {
            reviews: {
              severities: ['high'],
            },
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();

      const reviewWatcher = mock<FrigateReviewWatcher>();
      await camera.initialize({
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: mock<FrigateEventWatcher>(),
        frigateReviewWatcher: reviewWatcher,
      });
      expect(reviewWatcher.subscribe).toBeCalledWith(
        expect.objectContaining({
          instanceID: 'CLIENT_ID',
        }),
      );
    });

    it('should not subscribe to reviews without camera_name', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: {
            client_id: 'CLIENT_ID',
            // Note: no camera_name
          },
          triggers: {
            reviews: {
              severities: ['high'],
            },
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();

      const reviewWatcher = mock<FrigateReviewWatcher>();
      await camera.initialize({
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: mock<FrigateEventWatcher>(),
        frigateReviewWatcher: reviewWatcher,
      });
      expect(reviewWatcher.subscribe).not.toBeCalled();
    });

    it('should not subscribe to reviews with description only (no severities)', async () => {
      const camera = new FrigateCamera(
        createCameraConfig({
          frigate: {
            client_id: 'CLIENT_ID',
            camera_name: 'CAMERA',
          },
          triggers: {
            reviews: {
              severities: [],
              description: true,
            },
          },
        }),
        mock<CameraManagerEngine>(),
      );
      const hass = createHASS();

      const reviewWatcher = mock<FrigateReviewWatcher>();
      await camera.initialize({
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: mock<FrigateEventWatcher>(),
        frigateReviewWatcher: reviewWatcher,
      });
      // Severities are required - description alone is not enough
      expect(reviewWatcher.subscribe).not.toBeCalled();
    });

    describe('should call handler correctly', () => {
      it('should handle review severity triggers', async () => {
        const eventCallback = vi.fn();
        const camera = new FrigateCamera(
          createCameraConfig({
            id: 'CAMERA_1',
            frigate: {
              camera_name: 'front_door',
            },
            triggers: {
              reviews: {
                severities: ['high'],
              },
            },
          }),
          mock<CameraManagerEngine>(),
          {
            eventCallback: eventCallback,
          },
        );

        const hass = createHASS();
        const reviewWatcher = mock<FrigateReviewWatcher>();
        await camera.initialize({
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: reviewWatcher,
        });

        callReviewWatcherCallback(reviewWatcher, {
          type: 'new',
          before: {
            id: '123',
            camera: 'front_door',
            severity: 'alert',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: {},
          },
          after: {
            id: '123',
            camera: 'front_door',
            severity: 'alert',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: {},
          },
        });

        expect(eventCallback).toBeCalledWith({
          type: 'new',
          cameraID: 'CAMERA_1',
          id: '123',
          fidelity: 'high',
          review: true,
        });
      });

      it('should handle review description triggers', async () => {
        const eventCallback = vi.fn();
        const camera = new FrigateCamera(
          createCameraConfig({
            id: 'CAMERA_1',
            frigate: {
              camera_name: 'front_door',
            },
            triggers: {
              reviews: {
                severities: ['medium'],
                description: true,
              },
            },
          }),
          mock<CameraManagerEngine>(),
          {
            eventCallback: eventCallback,
          },
        );

        const hass = createHASS();
        const reviewWatcher = mock<FrigateReviewWatcher>();
        await camera.initialize({
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: reviewWatcher,
        });

        callReviewWatcherCallback(reviewWatcher, {
          type: 'update',
          before: {
            id: '123',
            camera: 'front_door',
            severity: 'detection',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: {
              metadata: {
                title: 'Old title',
              },
            },
          },
          after: {
            id: '123',
            camera: 'front_door',
            severity: 'detection',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: {
              metadata: {
                title: 'New title',
              },
            },
          },
        });

        expect(eventCallback).toBeCalledWith({
          type: 'update',
          cameraID: 'CAMERA_1',
          id: '123',
          fidelity: 'high',
          review: true,
        });
      });

      it('should handle review scene-only description triggers', async () => {
        const eventCallback = vi.fn();
        const camera = new FrigateCamera(
          createCameraConfig({
            id: 'CAMERA_1',
            frigate: {
              camera_name: 'front_door',
            },
            triggers: {
              reviews: {
                severities: ['medium'],
                description: true,
              },
            },
          }),
          mock<CameraManagerEngine>(),
          {
            eventCallback: eventCallback,
          },
        );

        const hass = createHASS();
        const reviewWatcher = mock<FrigateReviewWatcher>();
        await camera.initialize({
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: reviewWatcher,
        });

        callReviewWatcherCallback(reviewWatcher, {
          type: 'update',
          before: {
            id: '123',
            camera: 'front_door',
            severity: 'detection',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: {
              metadata: {
                scene: 'Old scene',
              },
            },
          },
          after: {
            id: '123',
            camera: 'front_door',
            severity: 'detection',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: {
              metadata: {
                scene: 'New scene',
              },
            },
          },
        });

        expect(eventCallback).toBeCalledWith({
          type: 'update',
          cameraID: 'CAMERA_1',
          id: '123',
          fidelity: 'high',
          review: true,
        });
      });

      it('should filter by zones', async () => {
        const eventCallback = vi.fn();
        const camera = new FrigateCamera(
          createCameraConfig({
            id: 'CAMERA_1',
            frigate: {
              camera_name: 'front_door',
              zones: ['yard'],
            },
            triggers: {
              reviews: {
                severities: ['high'],
              },
            },
          }),
          mock<CameraManagerEngine>(),
          {
            eventCallback: eventCallback,
          },
        );

        const hass = createHASS();
        const reviewWatcher = mock<FrigateReviewWatcher>();
        await camera.initialize({
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: reviewWatcher,
        });

        callReviewWatcherCallback(reviewWatcher, {
          type: 'new',
          before: {
            id: '123',
            camera: 'front_door',
            severity: 'alert',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: { zones: ['driveway'] },
          },
          after: {
            id: '123',
            camera: 'front_door',
            severity: 'alert',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: { zones: ['driveway'] },
          },
        });

        expect(eventCallback).not.toHaveBeenCalled();
      });

      it('should filter by labels', async () => {
        const eventCallback = vi.fn();
        const camera = new FrigateCamera(
          createCameraConfig({
            id: 'CAMERA_1',
            frigate: {
              camera_name: 'front_door',
              labels: ['person'],
            },
            triggers: {
              reviews: {
                severities: ['high'],
              },
            },
          }),
          mock<CameraManagerEngine>(),
          {
            eventCallback: eventCallback,
          },
        );

        const hass = createHASS();
        const reviewWatcher = mock<FrigateReviewWatcher>();
        await camera.initialize({
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: reviewWatcher,
        });

        callReviewWatcherCallback(reviewWatcher, {
          type: 'new',
          before: {
            id: '123',
            camera: 'front_door',
            severity: 'alert',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: { objects: ['car'] },
          },
          after: {
            id: '123',
            camera: 'front_door',
            severity: 'alert',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: { objects: ['car'] },
          },
        });

        expect(eventCallback).not.toHaveBeenCalled();
      });

      it('should ignore events when camera ID is not set', async () => {
        const eventCallback = vi.fn();
        const camera = new FrigateCamera(
          createCameraConfig({
            // Note: No 'id' is set here
            frigate: {
              camera_name: 'front_door',
            },
            triggers: {
              reviews: {
                severities: ['high'],
              },
            },
          }),
          mock<CameraManagerEngine>(),
          {
            eventCallback: eventCallback,
          },
        );

        const hass = createHASS();
        const reviewWatcher = mock<FrigateReviewWatcher>();
        await camera.initialize({
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: reviewWatcher,
        });

        callReviewWatcherCallback(reviewWatcher, {
          type: 'new',
          before: {
            id: '123',
            camera: 'front_door',
            severity: 'alert',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: {},
          },
          after: {
            id: '123',
            camera: 'front_door',
            severity: 'alert',
            start_time: 123,
            end_time: null,
            thumb_path: null,
            has_been_reviewed: false,
            data: {},
          },
        });

        expect(eventCallback).not.toHaveBeenCalled();
      });
    });
  });

  describe('should not trigger on non-matching reviews', () => {
    it('should not trigger when review severity does not match', async () => {
      const eventCallback = vi.fn();
      const camera = new FrigateCamera(
        createCameraConfig({
          id: 'CAMERA_1',
          frigate: {
            camera_name: 'front_door',
          },
          triggers: {
            reviews: {
              severities: ['high'],
              description: false,
            },
          },
        }),
        mock<CameraManagerEngine>(),
        {
          eventCallback: eventCallback,
        },
      );

      const hass = createHASS();
      const reviewWatcher = mock<FrigateReviewWatcher>();
      await camera.initialize({
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: mock<FrigateEventWatcher>(),
        frigateReviewWatcher: reviewWatcher,
      });

      callReviewWatcherCallback(reviewWatcher, {
        type: 'new',
        before: {
          id: '123',
          camera: 'front_door',
          severity: 'detection',
          start_time: 123,
          end_time: null,
          thumb_path: null,
          has_been_reviewed: false,
          data: {},
        },
        after: {
          id: '123',
          camera: 'front_door',
          severity: 'detection',
          start_time: 123,
          end_time: null,
          thumb_path: null,
          has_been_reviewed: false,
          data: {},
        },
      });

      expect(eventCallback).not.toHaveBeenCalled();
    });

    it('should not trigger on update without description change', async () => {
      const eventCallback = vi.fn();
      const camera = new FrigateCamera(
        createCameraConfig({
          id: 'CAMERA_1',
          frigate: {
            camera_name: 'front_door',
          },
          triggers: {
            reviews: {
              severities: ['high'],
              description: true,
            },
          },
        }),
        mock<CameraManagerEngine>(),
        {
          eventCallback: eventCallback,
        },
      );

      const hass = createHASS();
      const reviewWatcher = mock<FrigateReviewWatcher>();
      await camera.initialize({
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: mock<FrigateEventWatcher>(),
        frigateReviewWatcher: reviewWatcher,
      });

      // Update event with matching severity but no description change
      callReviewWatcherCallback(reviewWatcher, {
        type: 'update',
        before: {
          id: '123',
          camera: 'front_door',
          severity: 'alert',
          start_time: 123,
          end_time: null,
          thumb_path: null,
          has_been_reviewed: false,
          data: {
            metadata: {
              title: 'Same title',
            },
          },
        },
        after: {
          id: '123',
          camera: 'front_door',
          severity: 'alert',
          start_time: 123,
          end_time: null,
          thumb_path: null,
          has_been_reviewed: false,
          data: {
            metadata: {
              title: 'Same title', // No change
            },
          },
        },
      });

      expect(eventCallback).not.toHaveBeenCalled();
    });

    it('should trigger on end event with matching severity', async () => {
      const eventCallback = vi.fn();
      const camera = new FrigateCamera(
        createCameraConfig({
          id: 'CAMERA_1',
          frigate: {
            camera_name: 'front_door',
          },
          triggers: {
            reviews: {
              severities: ['high'],
            },
          },
        }),
        mock<CameraManagerEngine>(),
        {
          eventCallback: eventCallback,
        },
      );

      const hass = createHASS();
      const reviewWatcher = mock<FrigateReviewWatcher>();
      await camera.initialize({
        hassManager: createHASSManager({ hass }),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: mock<FrigateEventWatcher>(),
        frigateReviewWatcher: reviewWatcher,
      });

      callReviewWatcherCallback(reviewWatcher, {
        type: 'end',
        before: {
          id: '123',
          camera: 'front_door',
          severity: 'alert',
          start_time: 123,
          end_time: null,
          thumb_path: null,
          has_been_reviewed: false,
          data: {},
        },
        after: {
          id: '123',
          camera: 'front_door',
          severity: 'alert',
          start_time: 123,
          end_time: 456,
          thumb_path: null,
          has_been_reviewed: false,
          data: {},
        },
      });

      expect(eventCallback).toBeCalledWith({
        type: 'end',
        cameraID: 'CAMERA_1',
        id: '123',
        fidelity: 'high',
        review: true,
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
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: entityRegistryManager,
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: entityRegistryManager,
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: new EntityRegistryManagerMock(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
        });

        expect(camera.getConfig().triggers.entities).toEqual([]);
      });

      it('should throw when camera_entity is configured but registry has no match', async () => {
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
        await expect(
          camera.initialize({
            hassManager: createHASSManager(),
            entityRegistryManager: new EntityRegistryManagerMock(),
            frigateEventWatcher: mock<FrigateEventWatcher>(),
            frigateReviewWatcher: mock<FrigateReviewWatcher>(),
          }),
        ).rejects.toThrowError(/Could not find camera entity/);
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
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: entityRegistryManager,
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: entityRegistryManager,
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: new EntityRegistryManagerMock(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: entityRegistryManager,
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: entityRegistryManager,
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager({ hass }),
          entityRegistryManager: mock<EntityRegistryManager>(),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager(),
          entityRegistryManager: new EntityRegistryManagerMock([
            createRegistryEntity({ entity_id: 'camera.office_frigate' }),
          ]),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager(),
          entityRegistryManager: new EntityRegistryManagerMock([
            createRegistryEntity({ entity_id: 'camera.office_frigate' }),
          ]),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager(),
          entityRegistryManager: new EntityRegistryManagerMock([
            createRegistryEntity({ entity_id: 'camera.office_frigate' }),
          ]),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
          hassManager: createHASSManager(),
          entityRegistryManager: new EntityRegistryManagerMock([
            createRegistryEntity({ entity_id: 'camera.office_frigate' }),
          ]),
          frigateEventWatcher: mock<FrigateEventWatcher>(),
          frigateReviewWatcher: mock<FrigateReviewWatcher>(),
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
