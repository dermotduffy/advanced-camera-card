import { CameraConfig } from '../config/schema/cameras';
import { AdvancedCameraCardConfig } from '../config/schema/types';
import {
  MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA,
  MEDIA_PLAYER_SUPPORT_STOP,
  MEDIA_PLAYER_SUPPORT_TURN_OFF,
} from '../const';
import { localize } from '../localize/localize';
import { errorToConsole } from '../utils/basic';
import { supportsFeature } from '../utils/ha';
import { Entity } from '../utils/ha/registry/entity/types';
import { ViewMedia } from '../view/media';
import { ViewMediaClassifier } from '../view/media-classifier';
import { CardMediaPlayerAPI } from './types';

export class MediaPlayerManager {
  protected _mediaPlayers: string[] = [];

  protected _api: CardMediaPlayerAPI;

  constructor(api: CardMediaPlayerAPI) {
    this._api = api;
  }

  public getMediaPlayers(): string[] {
    return this._mediaPlayers;
  }

  public hasMediaPlayers(): boolean {
    return this._mediaPlayers.length > 0;
  }

  public async initializeIfNecessary(
    previousConfig: AdvancedCameraCardConfig | null,
  ): Promise<void> {
    if (
      previousConfig?.menu.buttons.media_player.enabled !==
      this._api.getConfigManager().getConfig()?.menu.buttons.media_player.enabled
    ) {
      await this.initialize();
    }
  }

  public async initialize(): Promise<boolean> {
    const hass = this._api.getHASSManager().getHASS();
    if (
      !hass ||
      !this._api.getConfigManager().getConfig()?.menu.buttons.media_player.enabled
    ) {
      return false;
    }

    const isValidMediaPlayer = (entityID: string): boolean => {
      if (entityID.startsWith('media_player.')) {
        const stateObj = hass.states[entityID];
        if (
          stateObj &&
          stateObj.state !== 'unavailable' &&
          supportsFeature(stateObj, MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA)
        ) {
          return true;
        }
      }
      return false;
    };

    const mediaPlayers = Object.keys(hass.states).filter(isValidMediaPlayer);
    let mediaPlayerEntities: Map<string, Entity> | null = null;
    try {
      mediaPlayerEntities = await this._api
        .getEntityRegistryManager()
        .getEntities(hass, mediaPlayers);
    } catch (e) {
      // Failing to fetch media player information is not considered
      // sufficiently serious to block card startup -- it is just logged and we
      // move on.
      errorToConsole(e as Error);
    }

    // Filter out entities that are marked as hidden (this information is not
    // available in the HA state, only in the registry).
    this._mediaPlayers = mediaPlayers.filter((entityID) => {
      // Specifically allow for media players that are not found in the entity registry:
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/1016
      const entity = mediaPlayerEntities?.get(entityID);
      return !entity || !entity.hidden_by;
    });

    return true;
  }

  public async stop(mediaPlayer: string): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();
    const stateObj = hass?.states[mediaPlayer];
    if (!stateObj) {
      return;
    }

    let service: string;
    if (supportsFeature(stateObj, MEDIA_PLAYER_SUPPORT_STOP)) {
      service = 'media_stop';
    } else if (supportsFeature(stateObj, MEDIA_PLAYER_SUPPORT_TURN_OFF)) {
      // Google Cast devices don't support media_stop, but turning off has the
      // same effect.
      service = 'turn_off';
    } else {
      return;
    }

    await hass.callService('media_player', service, {
      entity_id: mediaPlayer,
    });
  }

  public async playLive(mediaPlayer: string, cameraID: string): Promise<void> {
    const cameraConfig = this._api
      .getCameraManager()
      .getStore()
      .getCameraConfig(cameraID);
    if (!cameraConfig) {
      return;
    }

    if (cameraConfig.cast?.method === 'dashboard') {
      await this._playLiveDashboard(mediaPlayer, cameraConfig);
    } else {
      await this._playLiveStandard(mediaPlayer, cameraID, cameraConfig);
    }
  }

  protected async _playLiveStandard(
    mediaPlayer: string,
    cameraID: string,
    cameraConfig: CameraConfig,
  ): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();
    const cameraEntity = cameraConfig?.camera_entity ?? null;

    if (!hass || !cameraEntity) {
      return;
    }

    const title =
      this._api.getCameraManager().getCameraMetadata(cameraID)?.title ?? null;
    const thumbnail = hass.states[cameraEntity]?.attributes?.entity_picture ?? null;

    await hass.callService('media_player', 'play_media', {
      entity_id: mediaPlayer,
      media_content_id: `media-source://camera/${cameraEntity}`,
      media_content_type: 'application/vnd.apple.mpegurl',
      extra: {
        ...(title && { title: title }),
        ...(thumbnail && { thumb: thumbnail }),
      },
    });
  }

  protected async _playLiveDashboard(
    mediaPlayer: string,
    cameraConfig: CameraConfig,
  ): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();
    if (!hass) {
      return;
    }

    const dashboardConfig = cameraConfig.cast?.dashboard;
    if (!dashboardConfig?.dashboard_path || !dashboardConfig?.view_path) {
      this._api.getMessageManager().setMessageIfHigherPriority({
        type: 'error',
        icon: 'mdi:cast',
        message: localize('error.no_dashboard_or_view'),
      });
      return;
    }

    // When this bug is closed, a query string could be included:
    // https://github.com/home-assistant/core/issues/98316
    await hass.callService('cast', 'show_lovelace_view', {
      entity_id: mediaPlayer,
      dashboard_path: dashboardConfig.dashboard_path,
      view_path: dashboardConfig.view_path,
    });
  }

  public async playMedia(mediaPlayer: string, media?: ViewMedia | null): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();

    if (!hass || !media) {
      return;
    }

    const title = media.getTitle();
    const thumbnail = media.getThumbnail();

    await hass.callService('media_player', 'play_media', {
      entity_id: mediaPlayer,
      media_content_id: media.getContentID(),
      media_content_type: ViewMediaClassifier.isVideo(media) ? 'video' : 'image',
      extra: {
        ...(title && { title: title }),
        ...(thumbnail && { thumb: thumbnail }),
      },
    });
  }
}
