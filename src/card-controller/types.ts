import type { CameraManager } from '../camera-manager/manager';
import type { ConditionStateManager } from '../conditions/state-manager';
import type { Automation } from '../config/schema/automations';
import type { EntityRegistryManager } from '../utils/ha/registry/entity/types';
import type { ResolvedMediaCache } from '../utils/ha/resolved-media';
import type { ActionsManager } from './actions/actions-manager';
import type { AutomationsManager } from './automations-manager';
import type { CameraURLManager } from './camera-url-manager';
import type { CardElementManager } from './card-element-manager';
import type { ConfigManager } from './config/config-manager';
import type { DefaultManager } from './default-manager';
import type { DownloadManager } from './download-manager';
import type { ExpandManager } from './expand-manager';
import type { FullscreenManager } from './fullscreen/fullscreen-manager';
import type { HASSManager } from './hass/hass-manager';
import type { InitializationManager } from './initialization-manager';
import type { InteractionManager } from './interaction-manager';
import type { KeyboardStateManager } from './keyboard-state-manager';
import type { MediaLoadedInfoManager } from './media-info-manager';
import type { MediaPlayerManager } from './media-player-manager';
import type { MessageManager } from './message-manager';
import type { MicrophoneManager } from './microphone-manager';
import type { QueryStringManager } from './query-string-manager';
import type { StatusBarItemManager } from './status-bar-item-manager';
import type { StyleManager } from './style-manager';
import type { TriggersManager } from './triggers-manager';
import type { ViewManager } from './view/view-manager';

// *************************************************************************
//                             Manager APIs
// This defines a series of limited APIs that various managers use to control
// the card. Explicitly specifying them helps make coupling intentional and
// reduce cyclic dependencies.
// *************************************************************************

export interface CardActionsAPI {
  getActionsManager(): ActionsManager;
  getCameraManager(): CameraManager;
  getCameraURLManager(): CameraURLManager;
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getConfigManager(): ConfigManager;
  getDownloadManager(): DownloadManager;
  getExpandManager(): ExpandManager;
  getFullscreenManager(): FullscreenManager;
  getHASSManager(): HASSManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMediaPlayerManager(): MediaPlayerManager;
  getMessageManager(): MessageManager;
  getMicrophoneManager(): MicrophoneManager;
  getStatusBarItemManager(): StatusBarItemManager;
  getTriggersManager(): TriggersManager;
  getViewManager(): ViewManager;
}
export type CardActionsManagerAPI = CardActionsAPI;

export interface CardAutomationsAPI {
  getActionsManager(): ActionsManager;
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getHASSManager(): HASSManager;
  getInitializationManager(): InitializationManager;
  getMessageManager(): MessageManager;
}

export interface CardCameraAPI {
  getActionsManager(): ActionsManager;
  getConfigManager(): ConfigManager;
  getEntityRegistryManager(): EntityRegistryManager;
  getHASSManager(): HASSManager;
  getMessageManager(): MessageManager;
  getResolvedMediaCache(): ResolvedMediaCache;
  getTriggersManager(): TriggersManager;
}

export interface CardCameraURLAPI {
  getCameraManager(): CameraManager;
  getViewManager(): ViewManager;
}

export interface CardConditionAPI {
  getAutomationsManager(): AutomationsManager;
  getConfigManager(): ConfigManager;
}

export interface CardConfigAPI {
  getAutomationsManager(): AutomationsManager;
  getCameraManager(): CameraManager;
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getConfigManager(): ConfigManager;
  getDefaultManager(): DefaultManager;
  getHASSManager(): HASSManager;
  getInitializationManager(): InitializationManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMediaPlayerManager(): MediaPlayerManager;
  getMessageManager(): MessageManager;
  getMicrophoneManager(): MicrophoneManager;
  getStatusBarItemManager(): StatusBarItemManager;
  getStyleManager(): StyleManager;
  getViewManager(): ViewManager;
}

export interface CardConfigLoaderAPI {
  getAutomationsManager(): AutomationsManager;
  getConfigManager(): ConfigManager;
  getHASSManager(): HASSManager;
}

export interface CardDefaultManagerAPI {
  getAutomationsManager(): AutomationsManager;
  getConfigManager(): ConfigManager;
  getHASSManager(): HASSManager;
  getInteractionManager(): InteractionManager;
  getTriggersManager(): TriggersManager;
  getViewManager(): ViewManager;
}

export interface CardDownloadAPI {
  getCameraManager(): CameraManager;
  getHASSManager(): HASSManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMessageManager(): MessageManager;
  getViewManager(): ViewManager;
}

export interface CardElementAPI {
  getActionsManager(): ActionsManager;
  getCameraManager(): CameraManager;
  getConditionStateManager(): ConditionStateManager;
  getConfigManager(): ConfigManager;
  getDefaultManager(): DefaultManager;
  getExpandManager(): ExpandManager;
  getFullscreenManager(): FullscreenManager;
  getInitializationManager(): InitializationManager;
  getInteractionManager(): InteractionManager;
  getHASSManager(): HASSManager;
  getKeyboardStateManager(): KeyboardStateManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMediaPlayerManager(): MediaPlayerManager;
  getMicrophoneManager(): MicrophoneManager;
  getQueryStringManager(): QueryStringManager;
}

export interface CardExpandAPI {
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getFullscreenManager(): FullscreenManager;
}

export interface CardFullscreenAPI {
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getExpandManager(): ExpandManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMediaPlayerManager(): MediaPlayerManager;
}

export interface CardHASSAPI {
  getCameraManager(): CameraManager;
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getConfigManager(): ConfigManager;
  getDefaultManager(): DefaultManager;
  getInteractionManager(): InteractionManager;
  getMediaPlayerManager(): MediaPlayerManager;
  getMessageManager(): MessageManager;
  getStyleManager(): StyleManager;
  getTriggersManager(): TriggersManager;
  getViewManager(): ViewManager;
}

export interface CardInitializerAPI {
  createCameraManager(): void;
  getCameraManager(): CameraManager;

  createMicrophoneManager(): void;
  getMicrophoneManager(): MicrophoneManager;

  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getConfigManager(): ConfigManager;
  getConditionStateManager(): ConditionStateManager;
  getDefaultManager(): DefaultManager;
  getEntityRegistryManager(): EntityRegistryManager;
  getHASSManager(): HASSManager;
  getMediaPlayerManager(): MediaPlayerManager;
  getMessageManager(): MessageManager;
  getQueryStringManager(): QueryStringManager;
  getResolvedMediaCache(): ResolvedMediaCache;
  getViewManager(): ViewManager;
}

export interface CardInteractionAPI {
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getConfigManager(): ConfigManager;
  getStyleManager(): StyleManager;
  getTriggersManager(): TriggersManager;
  getViewManager(): ViewManager;
}

export interface CardKeyboardStateAPI {
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getConfigManager(): ConfigManager;
}

export interface CardMediaLoadedAPI {
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getConfigManager(): ConfigManager;
  getFullscreenManager(): FullscreenManager;
  getStyleManager(): StyleManager;
}

export interface CardMediaPlayerAPI {
  getCameraManager(): CameraManager;
  getConfigManager(): ConfigManager;
  getEntityRegistryManager(): EntityRegistryManager;
  getHASSManager(): HASSManager;
  getMessageManager(): MessageManager;
  getQueryStringManager(): QueryStringManager;
}

export interface CardMessageAPI {
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
}

export interface CardMicrophoneAPI {
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getConfigManager(): ConfigManager;
}

export interface CardQueryStringAPI {
  getActionsManager(): ActionsManager;
  getCardElementManager(): CardElementManager;
  getViewManager(): ViewManager;
}

export interface CardStatusBarAPI {
  getCardElementManager(): CardElementManager;
}

export interface CardStyleAPI {
  getCardElementManager(): CardElementManager;
  getConfigManager(): ConfigManager;
  getExpandManager(): ExpandManager;
  getFullscreenManager(): FullscreenManager;
  getHASSManager(): HASSManager;
  getInteractionManager(): InteractionManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getViewManager(): ViewManager;
}

export interface CardTriggersAPI {
  getCameraManager(): CameraManager;
  getConditionStateManager(): ConditionStateManager;
  getCardElementManager(): CardElementManager;
  getConfigManager(): ConfigManager;
  getInteractionManager(): InteractionManager;
  getViewManager(): ViewManager;
}

export interface CardViewAPI {
  getCameraManager(): CameraManager;
  getCardElementManager(): CardElementManager;
  getConditionStateManager(): ConditionStateManager;
  getConfigManager(): ConfigManager;
  getHASSManager(): HASSManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMessageManager(): MessageManager;
  getQueryStringManager(): QueryStringManager;
  getStyleManager(): StyleManager;
  getTriggersManager(): TriggersManager;
}

// *************************************************************************
//                             Common Types
// *************************************************************************

export interface KeysState {
  [key: string]: {
    state: 'down' | 'up';
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export interface MicrophoneState {
  stream?: MediaStream | null;
  connected: boolean;
  muted: boolean;
  forbidden: boolean;
}

export interface TaggedAutomation extends Automation {
  tag?: unknown;
}
