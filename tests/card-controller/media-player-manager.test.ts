import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MediaPlayerManager } from '../../src/card-controller/media-player-manager.js';
import {
  MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA,
  MEDIA_PLAYER_SUPPORT_STOP,
  MEDIA_PLAYER_SUPPORT_TURN_OFF,
} from '../../src/const';
import { HomeAssistant } from '../../src/ha/types.js';
import { EntityRegistryManager } from '../../src/utils/ha/registry/entity/index.js';
import {
  createCameraConfig,
  createCameraManager,
  createCardAPI,
  createConfig,
  createHASS,
  createRegistryEntity,
  createStateEntity,
  createStore,
  TestViewMedia,
} from '../test-utils.js';

const createHASSWithMediaPlayers = (): HomeAssistant => {
  const attributesSupported = {
    supported_features: MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA,
  };
  const attributesUnsupported = {
    supported_features: 0,
  };

  return createHASS({
    'media_player.ok1': createStateEntity({
      entity_id: 'media_player.ok1',
      state: 'on',
      attributes: attributesSupported,
    }),
    'media_player.ok2': createStateEntity({
      entity_id: 'media_player.ok2',
      state: 'on',
      attributes: attributesSupported,
    }),
    'media_player.ok3': createStateEntity({
      entity_id: 'media_player.ok3',
      state: 'on',
      attributes: attributesSupported,
    }),
    'media_player.unavailable': createStateEntity({
      entity_id: 'media_player.sitting_room',
      state: 'unavailable',
      attributes: attributesSupported,
    }),
    'media_player.unsupported': createStateEntity({
      entity_id: 'media_player.sitting_room',
      state: 'on',
      attributes: attributesUnsupported,
    }),
    'switch.unrelated': createStateEntity({
      entity_id: 'switch.unrelated',
      state: 'on',
    }),
  });
};

describe('MediaPlayerManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('should initialize', () => {
    it('correctly', async () => {
      const entityRegistryManager = mock<EntityRegistryManager>();
      entityRegistryManager.getEntities.mockResolvedValue(
        new Map([
          ['media_player.ok1', createRegistryEntity({ hidden_by: '' })],
          ['media_player.ok2', createRegistryEntity({ hidden_by: 'user' })],
        ]),
      );

      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
        createHASSWithMediaPlayers(),
      );
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          menu: {
            buttons: {
              media_player: {
                enabled: true,
              },
            },
          },
        }),
      );
      vi.mocked(api.getEntityRegistryManager).mockReturnValue(entityRegistryManager);
      const manager = new MediaPlayerManager(api);

      await manager.initialize();

      expect(manager.getMediaPlayers()).toEqual([
        'media_player.ok1',
        'media_player.ok3',
      ]);
      expect(manager.hasMediaPlayers()).toBeTruthy();
    });

    it('without hass', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
      const manager = new MediaPlayerManager(api);

      await manager.initialize();

      expect(manager.getMediaPlayers()).toEqual([]);
      expect(manager.hasMediaPlayers()).toBeFalsy();
    });

    it('even if entity registry call fails', async () => {
      const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);

      const entityRegistryManager = mock<EntityRegistryManager>();
      entityRegistryManager.getEntities.mockRejectedValue(new Error('message'));

      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
        createHASSWithMediaPlayers(),
      );
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          menu: {
            buttons: {
              media_player: {
                enabled: true,
              },
            },
          },
        }),
      );
      vi.mocked(api.getEntityRegistryManager).mockReturnValue(entityRegistryManager);
      const manager = new MediaPlayerManager(api);

      await manager.initialize();

      expect(manager.getMediaPlayers()).toEqual([
        'media_player.ok1',
        'media_player.ok2',
        'media_player.ok3',
      ]);
      expect(manager.hasMediaPlayers()).toBeTruthy();
      expect(spy).toBeCalled();
    });

    it('should reinitialize when there is a config change', async () => {
      const entityRegistryManager = mock<EntityRegistryManager>();
      entityRegistryManager.getEntities.mockResolvedValue(
        new Map([
          ['media_player.ok1', createRegistryEntity({ hidden_by: '' })],
          ['media_player.ok2', createRegistryEntity({ hidden_by: 'user' })],
        ]),
      );

      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
        createHASSWithMediaPlayers(),
      );
      const config = createConfig({
        menu: {
          buttons: {
            media_player: {
              enabled: true,
            },
          },
        },
      });
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(config);
      vi.mocked(api.getEntityRegistryManager).mockReturnValue(entityRegistryManager);
      const manager = new MediaPlayerManager(api);

      await manager.initializeIfNecessary(null);
      expect(manager.hasMediaPlayers()).toBeTruthy();

      await manager.initializeIfNecessary(config);
      expect(manager.hasMediaPlayers()).toBeTruthy();
    });
  });

  describe('should stop', () => {
    it('should call media_stop when device supports it', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
        createHASS({
          'media_player.foo': createStateEntity({
            entity_id: 'media_player.foo',
            attributes: {
              supported_features: MEDIA_PLAYER_SUPPORT_STOP,
            },
          }),
        }),
      );

      const manager = new MediaPlayerManager(api);

      await manager.stop('media_player.foo');

      expect(api.getHASSManager().getHASS()?.callService).toBeCalledWith(
        'media_player',
        'media_stop',
        {
          entity_id: 'media_player.foo',
        },
      );
    });

    it('should call turn_off when device does supports it', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
        createHASS({
          'media_player.foo': createStateEntity({
            entity_id: 'media_player.foo',
            attributes: {
              supported_features: MEDIA_PLAYER_SUPPORT_TURN_OFF,
            },
          }),
        }),
      );

      const manager = new MediaPlayerManager(api);

      await manager.stop('media_player.foo');

      expect(api.getHASSManager().getHASS()?.callService).toBeCalledWith(
        'media_player',
        'turn_off',
        {
          entity_id: 'media_player.foo',
        },
      );
    });

    it('should do nothing without some supported feature', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
        createHASS({
          'media_player.foo': createStateEntity({
            entity_id: 'media_player.foo',
          }),
        }),
      );
      const manager = new MediaPlayerManager(api);

      await manager.stop('media_player.foo');

      expect(api.getHASSManager().getHASS()?.callService).not.toBeCalled();
    });

    it('should do nothing without hass state', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const manager = new MediaPlayerManager(api);

      await manager.stop('media_player.foo');

      expect(api.getHASSManager().getHASS()?.callService).not.toBeCalled();
    });
  });

  describe('should play', () => {
    describe('live', () => {
      it('without camera config', async () => {
        const api = createCardAPI();
        vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
        const manager = new MediaPlayerManager(api);

        await manager.playLive('media_player.foo', 'camera');

        expect(api.getHASSManager().getHASS()?.callService).not.toBeCalled();
      });

      describe('using standard method', () => {
        it('successfully', async () => {
          const api = createCardAPI();
          vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
          vi.mocked(api.getCameraManager().getStore).mockReturnValue(
            createStore([
              {
                cameraID: 'camera.foo',
                config: createCameraConfig({
                  camera_entity: 'camera.foo',
                }),
              },
            ]),
          );
          vi.mocked(api.getCameraManager().getCameraMetadata).mockReturnValue({
            title: 'camera title',
            icon: { icon: 'icon' },
          });
          vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
            createHASS({
              'camera.foo': createStateEntity({
                attributes: {
                  entity_picture: 'http://thumbnail',
                },
              }),
            }),
          );
          const manager = new MediaPlayerManager(api);

          await manager.playLive('media_player.foo', 'camera.foo');

          expect(api.getHASSManager().getHASS()?.callService).toBeCalledWith(
            'media_player',
            'play_media',
            {
              entity_id: 'media_player.foo',
              media_content_id: 'media-source://camera/camera.foo',
              media_content_type: 'application/vnd.apple.mpegurl',
              extra: {
                title: 'camera title',
                thumb: 'http://thumbnail',
              },
            },
          );
        });

        it('without camera_entity', async () => {
          const api = createCardAPI();
          vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());

          vi.mocked(api.getCameraManager().getStore).mockReturnValue(
            createStore([
              {
                cameraID: 'camera.foo',
                config: createCameraConfig(),
              },
            ]),
          );
          vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
          const manager = new MediaPlayerManager(api);

          await manager.playLive('media_player.foo', 'camera.foo');

          expect(api.getHASSManager().getHASS()?.callService).not.toBeCalled();
        });

        it('without title and thumbnail', async () => {
          const api = createCardAPI();
          vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
          vi.mocked(api.getCameraManager().getStore).mockReturnValue(
            createStore([
              {
                cameraID: 'camera.foo',
                config: createCameraConfig({
                  camera_entity: 'camera.foo',
                }),
              },
            ]),
          );
          vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
          const manager = new MediaPlayerManager(api);

          await manager.playLive('media_player.foo', 'camera.foo');

          expect(api.getHASSManager().getHASS()?.callService).toBeCalledWith(
            'media_player',
            'play_media',
            {
              entity_id: 'media_player.foo',
              media_content_id: 'media-source://camera/camera.foo',
              media_content_type: 'application/vnd.apple.mpegurl',
              extra: {},
            },
          );
        });
      });

      describe('using dashboard method', () => {
        it('successfully', async () => {
          const api = createCardAPI();
          vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
          vi.mocked(api.getCameraManager().getStore).mockReturnValue(
            createStore([
              {
                cameraID: 'camera.foo',
                config: createCameraConfig({
                  camera_entity: 'camera.foo',
                  cast: {
                    method: 'dashboard',
                    dashboard: {
                      dashboard_path: 'dashboard_path',
                      view_path: 'view_path',
                    },
                  },
                }),
              },
            ]),
          );
          vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
          const manager = new MediaPlayerManager(api);

          await manager.playLive('media_player.foo', 'camera.foo');

          expect(api.getHASSManager().getHASS()?.callService).toBeCalledWith(
            'cast',
            'show_lovelace_view',
            {
              entity_id: 'media_player.foo',
              dashboard_path: 'dashboard_path',
              view_path: 'view_path',
            },
          );
        });

        it('without hass', async () => {
          const api = createCardAPI();
          vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
          vi.mocked(api.getCameraManager().getStore).mockReturnValue(
            createStore([
              {
                cameraID: 'camera.foo',
                config: createCameraConfig({
                  camera_entity: 'camera.foo',
                  cast: {
                    method: 'dashboard',
                    dashboard: {
                      dashboard_path: 'dashboard_path',
                      view_path: 'view_path',
                    },
                  },
                }),
              },
            ]),
          );
          vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
          const manager = new MediaPlayerManager(api);

          await manager.playLive('media_player.foo', 'camera.foo');

          // No actual test can be performed here as nothing observable happens.
          // This test serves only as code-coverage long-tail.
        });
      });

      it('without required configuration', async () => {
        const api = createCardAPI();
        vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
        vi.mocked(api.getCameraManager().getStore).mockReturnValue(
          createStore([
            {
              cameraID: 'camera.foo',
              config: createCameraConfig({
                camera_entity: 'camera.foo',
                cast: {
                  method: 'dashboard',
                },
              }),
            },
          ]),
        );
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = new MediaPlayerManager(api);

        await manager.playLive('media_player.foo', 'camera.foo');

        expect(
          vi.mocked(api.getMessageManager().setMessageIfHigherPriority),
        ).toBeCalledWith({
          type: 'error',
          icon: 'mdi:cast',
          message:
            "Both 'dashboard_path' and 'view_path' parameters are required " +
            "for the 'dashboard' cast method",
        });
      });
    });

    describe('media', () => {
      describe('successfully with', () => {
        it.each([
          ['clip' as const, 'video' as const],
          ['snapshot' as const, 'image' as const],
        ])(
          '%s',
          async (mediaType: 'clip' | 'snapshot', contentType: 'video' | 'image') => {
            const media = new TestViewMedia({
              title: 'media title',
              thumbnail: 'http://thumbnail',
              contentID: 'media-source://contentid',
              mediaType: mediaType,
            });
            const api = createCardAPI();
            vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
            const manager = new MediaPlayerManager(api);

            await manager.playMedia('media_player.foo', media);

            expect(api.getHASSManager().getHASS()?.callService).toBeCalledWith(
              'media_player',
              'play_media',
              {
                entity_id: 'media_player.foo',
                media_content_id: 'media-source://contentid',
                media_content_type: contentType,
                extra: {
                  title: 'media title',
                  thumb: 'http://thumbnail',
                },
              },
            );
          },
        );
      });

      it('without hass', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
        const manager = new MediaPlayerManager(api);
        const media = new TestViewMedia();

        await manager.playMedia('media_player.foo', media);

        // No actual test can be performed here as nothing observable happens.
        // This test serves only as code-coverage long-tail.
      });
    });
  });
});
