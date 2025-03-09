import {
  Auth,
  Connection,
  HassConfig,
  HassEntities,
  HassServices,
  HassServiceTarget,
  MessageBase,
} from 'home-assistant-js-websocket';
import { HapticType } from './haptic.js';

interface ToggleMenuActionConfig extends BaseActionConfig {
  action: 'toggle-menu';
}

export interface ToggleActionConfig extends BaseActionConfig {
  action: 'toggle';
}

export interface CallServiceActionConfig extends BaseActionConfig {
  action: 'call-service';
  service: string;
  data?: {
    entity_id?: string | [string];
    [key: string]: unknown;
  };
  target?: HassServiceTarget;
  repeat?: number;
  haptic?: HapticType;
}

export interface PerformActionActionConfig extends BaseActionConfig {
  action: 'perform-action';
  perform_action: string;
  data?: {
    entity_id?: string | [string];
    [key: string]: unknown;
  };
  target?: HassServiceTarget;
  repeat?: number;
  haptic?: HapticType;
}

export interface NavigateActionConfig extends BaseActionConfig {
  action: 'navigate';
  navigation_path: string;
}

export interface UrlActionConfig extends BaseActionConfig {
  action: 'url';
  url_path: string;
}
export interface MoreInfoActionConfig extends BaseActionConfig {
  action: 'more-info';
  entity?: string;
}
export interface NoActionConfig extends BaseActionConfig {
  action: 'none';
}
interface CustomActionConfig extends BaseActionConfig {
  action: 'fire-dom-event';
}
/**
 * `repeat` and `haptic` are specifically for use in custom cards like the Button-Card
 */
interface BaseActionConfig {
  confirmation?: ConfirmationRestrictionConfig;
  repeat?: number;
  haptic?: HapticType;
}

export interface ConfirmationRestrictionConfig {
  text?: string;
  exemptions?: RestrictionConfig[];
}

interface RestrictionConfig {
  user: string;
}

export declare type ActionConfig =
  | ToggleActionConfig
  | CallServiceActionConfig
  | PerformActionActionConfig
  | NavigateActionConfig
  | UrlActionConfig
  | MoreInfoActionConfig
  | NoActionConfig
  | CustomActionConfig
  | ToggleMenuActionConfig;

declare global {
  interface HASSDomEvents {
    'value-changed': {
      value: unknown;
    };
    'config-changed': {
      config: unknown;
    };
    'hass-more-info': {
      entityId: string | undefined;
    };
    'll-rebuild': object;
    'll-custom': object;
    'location-changed': {
      replace: boolean;
    };
    'show-dialog': object;
    undefined: unknown;
    action: {
      action: string;
    };
  }
}

export type ValidHassDomEvent = keyof HASSDomEvents;

declare type LocalizeFunc = (key: string, ...args: unknown[]) => string;

interface Credential {
  auth_provider_type: string;
  auth_provider_id: string;
}

interface MFAModule {
  id: string;
  name: string;
  enabled: boolean;
}

export interface CurrentUser {
  id: string;
  is_owner: boolean;
  is_admin: boolean;
  name: string;
  credentials: Credential[];
  mfa_modules: MFAModule[];
}

interface Theme {
  'primary-color': string;
  'text-primary-color': string;
  'accent-color': string;
}

interface Themes {
  darkMode?: boolean;
  default_theme: string;
  themes: {
    [key: string]: Theme;
  };
}

interface Panel {
  component_name: string;
  config: {
    [key: string]: unknown;
  } | null;
  icon: string | null;
  title: string | null;
  url_path: string;
}

interface Panels {
  [name: string]: Panel;
}

interface Resources {
  [language: string]: {
    [key: string]: string;
  };
}

interface Translation {
  nativeName: string;
  isRTL: boolean;
  fingerprints: {
    [fragment: string]: string;
  };
}

export interface ServiceCallRequest {
  domain: string;
  service: string;
  serviceData?: Record<string, unknown>;
  target?: HassServiceTarget;
}

export interface HomeAssistant {
  auth: Auth;
  connection: Connection;
  connected: boolean;
  states: HassEntities;
  services: HassServices;
  config: HassConfig;
  themes: Themes;
  selectedTheme?: string | null;
  panels: Panels;
  panelUrl: string;
  language: string;
  locale: FrontendLocaleData;
  selectedLanguage: string | null;
  resources: Resources;
  localize: LocalizeFunc;
  translationMetadata: {
    fragments: string[];
    translations: {
      [lang: string]: Translation;
    };
  };
  dockedSidebar: boolean;
  moreInfoEntityId: string;
  user: CurrentUser;
  callService: (
    domain: ServiceCallRequest['domain'],
    service: ServiceCallRequest['service'],
    serviceData?: ServiceCallRequest['serviceData'],
    target?: ServiceCallRequest['target'],
  ) => Promise<void>;
  callApi: <T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    parameters?: {
      [key: string]: unknown;
    },
  ) => Promise<T>;
  fetchWithAuth: (
    path: string,
    init?: {
      [key: string]: unknown;
    },
  ) => Promise<Response>;
  hassUrl(path?): string;
  sendWS: (msg: MessageBase) => Promise<void>;
  callWS: <T>(msg: MessageBase) => Promise<T>;
}

declare enum NumberFormat {
  language = 'language',
  system = 'system',
  comma_decimal = 'comma_decimal',
  decimal_comma = 'decimal_comma',
  space_comma = 'space_comma',
  none = 'none',
}

declare enum TimeFormat {
  language = 'language',
  system = 'system',
  am_pm = '12',
  twenty_four = '24',
}

interface FrontendLocaleData {
  language: string;
  number_format: NumberFormat;
  time_format: TimeFormat;
}

export interface LovelaceCardConfig {
  index?: number;
  view_index?: number;
  type: string;
  [key: string]: unknown;
}

export interface LovelaceCard extends HTMLElement {
  hass?: HomeAssistant;
  isPanel?: boolean;
  editMode?: boolean;
  getCardSize(): number | Promise<number>;
  setConfig(config: LovelaceCardConfig): void;
}

export interface LovelaceCardEditor extends HTMLElement {
  hass?: HomeAssistant;
  lovelace?: LovelaceConfig;
  setConfig(config: LovelaceCardConfig): void;
}

interface LovelaceConfig {
  title?: string;
  views: LovelaceViewConfig[];
  background?: string;
}

interface LovelaceViewConfig {
  index?: number;
  title?: string;
  badges?: Array<string | LovelaceBadgeConfig>;
  cards?: LovelaceCardConfig[];
  path?: string;
  icon?: string;
  theme?: string;
  panel?: boolean;
  background?: string;
  visible?: boolean | ShowViewConfig[];
}

interface ShowViewConfig {
  user?: string;
}

interface LovelaceBadgeConfig {
  type?: string;
  [key: string]: unknown;
}

export interface ActionHandlerDetail {
  action: string;
}

export interface ActionHandlerOptions {
  hasHold?: boolean;
  hasDoubleClick?: boolean;
}
