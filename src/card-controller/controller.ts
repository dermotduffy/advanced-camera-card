import { ReactiveController } from 'lit';
import { CameraManager } from '../camera-manager/manager';
import { ConditionStateManager } from '../conditions/state-manager';
import { AdvancedCameraCardConfig } from '../config/schema/types';
import { DeviceRegistryManager } from '../ha/registry/device';
import { DeviceCache } from '../ha/registry/device/types';
import { EntityRegistryManagerLive } from '../ha/registry/entity';
import { EntityCache, EntityRegistryManager } from '../ha/registry/entity/types';
import { ResolvedMediaCache } from '../ha/resolved-media';
import { LovelaceCardEditor } from '../ha/types';
import { ActionsManager } from './actions/actions-manager';
import { AutomationsManager } from './automations-manager';
import { CameraURLManager } from './camera-url-manager';
import {
  CardElementManager,
  CardHTMLElement,
  MenuToggleCallback,
  ScrollCallback,
} from './card-element-manager';
import { ConfigManager } from './config/config-manager';
import { DefaultManager } from './default-manager';
import { EffectsManager } from './effects/effects-manager';
import { ExpandManager } from './expand-manager';
import { FoldersManager } from './folders/manager';
import { FullscreenManager } from './fullscreen/fullscreen-manager';
import { HASSManager } from './hass/hass-manager';
import { InitializationManager } from './initialization-manager';
import { InteractionManager } from './interaction-manager';
import { KeyboardStateManager } from './keyboard-state-manager';
import { LockManager } from './lock/manager';
import { MediaLoadedInfoManager } from './media-info-manager';
import { MediaPlayerManager } from './media-player-manager';
import { MicrophoneManager } from './microphone-manager';
import { NotificationManager } from './notification-manager';
import { PIPManager } from './pip-manager';
import { createIssueManager } from './issues/factory';
import { IssueManager } from './issues/issue-manager';
import { QueryStringManager } from './query-string-manager';
import { StatusBarItemManager } from './status-bar-item-manager';
import { StyleManager } from './style-manager';
import { TemplateRenderer } from './templates';
import { TriggersManager } from './triggers-manager';
import {
  CardActionsManagerAPI,
  CardAutomationsAPI,
  CardCameraAPI,
  CardCameraURLAPI,
  CardConditionAPI,
  CardConfigAPI,
  CardDefaultManagerAPI,
  CardDownloadAPI,
  CardElementAPI,
  CardExpandAPI,
  CardFullscreenAPI,
  CardHASSAPI,
  CardInitializerAPI,
  CardInteractionAPI,
  CardKeyboardStateAPI,
  CardLockAPI,
  CardMediaLoadedAPI,
  CardMediaPlayerAPI,
  CardMicrophoneAPI,
  CardNotificationAPI,
  CardPIPAPI,
  CardIssueManagerAPI,
  CardQueryStringAPI,
  CardStyleAPI,
  CardTriggersAPI,
  CardViewAPI,
} from './types';
import { ViewItemManager } from './view/item-manager';
import { ViewManager } from './view/view-manager';

export class CardController
  implements
    CardActionsManagerAPI,
    CardAutomationsAPI,
    CardCameraAPI,
    CardCameraURLAPI,
    CardConditionAPI,
    CardConfigAPI,
    CardDefaultManagerAPI,
    CardDownloadAPI,
    CardElementAPI,
    CardExpandAPI,
    CardFullscreenAPI,
    CardHASSAPI,
    CardPIPAPI,
    CardIssueManagerAPI,
    CardInitializerAPI,
    CardInteractionAPI,
    CardKeyboardStateAPI,
    CardLockAPI,
    CardMediaLoadedAPI,
    CardMediaPlayerAPI,
    CardMicrophoneAPI,
    CardNotificationAPI,
    CardQueryStringAPI,
    CardStyleAPI,
    CardTriggersAPI,
    CardViewAPI,
    ReactiveController
{
  private _conditionStateManager = new ConditionStateManager();
  private _effectsManager = new EffectsManager();

  // These properties may be used in the construction of 'managers' (and should
  // be created first).
  private _deviceRegistryManager = new DeviceRegistryManager(new DeviceCache());
  private _entityRegistryManager = new EntityRegistryManagerLive(new EntityCache());
  private _resolvedMediaCache = new ResolvedMediaCache();

  private _actionsManager = new ActionsManager(this, new TemplateRenderer());
  private _automationsManager = new AutomationsManager(this);
  private _cameraManager = new CameraManager(this);
  private _cameraURLManager = new CameraURLManager(this);
  private _cardElementManager: CardElementManager;
  private _configManager = new ConfigManager(this);
  private _defaultManager = new DefaultManager(this);
  private _expandManager = new ExpandManager(this);
  private _foldersManager = new FoldersManager(this);
  private _fullscreenManager = new FullscreenManager(this);
  private _hassManager = new HASSManager(this);
  private _initializationManager = new InitializationManager(this);
  private _interactionManager = new InteractionManager(this);
  private _keyboardStateManager = new KeyboardStateManager(this);
  private _lockManager = new LockManager(this);
  private _mediaLoadedInfoManager = new MediaLoadedInfoManager(this);

  private _mediaPlayerManager = new MediaPlayerManager(this);
  private _microphoneManager = new MicrophoneManager(this);
  private _notificationManager = new NotificationManager(this);
  private _pipManager = new PIPManager(this);
  private _issueManager = createIssueManager(this);
  private _queryStringManager = new QueryStringManager(this);
  private _statusBarItemManager = new StatusBarItemManager(this);
  private _styleManager = new StyleManager(this);
  private _triggersManager = new TriggersManager(this);
  private _viewManager = new ViewManager(this);
  private _viewItemManager = new ViewItemManager(this);

  constructor(
    host: CardHTMLElement,
    scrollCallback: ScrollCallback,
    menuToggleCallback: MenuToggleCallback,
  ) {
    host.addController(this);

    this._cardElementManager = new CardElementManager(
      this,
      host,
      scrollCallback,
      menuToggleCallback,
    );
  }

  // *************************************************************************
  //                           Accessors
  // *************************************************************************

  public getActionsManager(): ActionsManager {
    return this._actionsManager;
  }

  public getAutomationsManager(): AutomationsManager {
    return this._automationsManager;
  }

  public getCameraManager(): CameraManager {
    return this._cameraManager;
  }
  public createCameraManager(): void {
    this._cameraManager = new CameraManager(this);
  }

  public getCameraURLManager(): CameraURLManager {
    return this._cameraURLManager;
  }

  public getCardElementManager(): CardElementManager {
    return this._cardElementManager;
  }

  public getConditionStateManager(): ConditionStateManager {
    return this._conditionStateManager;
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('../editor.js');
    return document.createElement('advanced-camera-card-editor');
  }

  public getConfigManager(): ConfigManager {
    return this._configManager;
  }

  public getDefaultManager(): DefaultManager {
    return this._defaultManager;
  }

  public getDeviceRegistryManager(): DeviceRegistryManager {
    return this._deviceRegistryManager;
  }

  public getEffectsManager(): EffectsManager {
    return this._effectsManager;
  }

  public getEntityRegistryManager(): EntityRegistryManager {
    return this._entityRegistryManager;
  }

  public getExpandManager(): ExpandManager {
    return this._expandManager;
  }

  public getFoldersManager(): FoldersManager {
    return this._foldersManager;
  }

  public getFullscreenManager(): FullscreenManager {
    return this._fullscreenManager;
  }

  public getHASSManager(): HASSManager {
    return this._hassManager;
  }

  public getInitializationManager(): InitializationManager {
    return this._initializationManager;
  }

  public getInteractionManager(): InteractionManager {
    return this._interactionManager;
  }

  public getKeyboardStateManager(): KeyboardStateManager {
    return this._keyboardStateManager;
  }

  public getLockManager(): LockManager {
    return this._lockManager;
  }

  public getMediaLoadedInfoManager(): MediaLoadedInfoManager {
    return this._mediaLoadedInfoManager;
  }

  public getMediaPlayerManager(): MediaPlayerManager {
    return this._mediaPlayerManager;
  }

  public getMicrophoneManager(): MicrophoneManager {
    return this._microphoneManager;
  }
  public createMicrophoneManager(): void {
    this._microphoneManager = new MicrophoneManager(this);
  }

  public getNotificationManager(): NotificationManager {
    return this._notificationManager;
  }

  public getPIPManager(): PIPManager {
    return this._pipManager;
  }

  public getIssueManager(): IssueManager {
    return this._issueManager;
  }

  public getQueryStringManager(): QueryStringManager {
    return this._queryStringManager;
  }

  public getResolvedMediaCache(): ResolvedMediaCache {
    return this._resolvedMediaCache;
  }

  public getStatusBarItemManager(): StatusBarItemManager {
    return this._statusBarItemManager;
  }

  public static getStubConfig(entities: string[]): AdvancedCameraCardConfig {
    const cameraEntity = entities.find((element) => element.startsWith('camera.'));
    return {
      cameras: [
        {
          camera_entity: cameraEntity ?? 'camera.demo',
        },
      ],
      // Need to use 'as unknown' to convince Typescript that this really isn't a
      // mistake, despite the miniscule size of the configuration vs the full type
      // description.
    } as unknown as AdvancedCameraCardConfig;
  }

  public getStyleManager(): StyleManager {
    return this._styleManager;
  }

  public getTriggersManager(): TriggersManager {
    return this._triggersManager;
  }

  public getViewManager(): ViewManager {
    return this._viewManager;
  }

  public getViewItemManager(): ViewItemManager {
    return this._viewItemManager;
  }

  // *************************************************************************
  //                            Handlers
  // *************************************************************************

  public hostConnected(): void {
    this.getCardElementManager().elementConnected();
  }

  public hostDisconnected(): void {
    this.getCardElementManager().elementDisconnected();
  }
}
