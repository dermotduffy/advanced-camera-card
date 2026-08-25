import type {
  Auth,
  Connection,
  HassConfig,
  HassEntities,
  HassEntity,
  HassServices,
  HassServiceTarget,
  MessageBase,
} from 'home-assistant-js-websocket';
import type { ReadonlyDeep } from 'type-fest';
import { z } from 'zod';

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
    serviceData?: ReadonlyDeep<ServiceCallRequest['serviceData']>,
    target?: ReadonlyDeep<ServiceCallRequest['target']>,
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
  hassUrl(path?: string): string;
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
  preview?: boolean;
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

export interface HassStateDifference {
  entityID: string;
  oldState?: HassEntity;
  newState: HassEntity;
}

// *************************************************************************
//                     Home Assistant API types.
// *************************************************************************
// Server side data-type defined here:
// https://github.com/home-assistant/core/blob/dev/homeassistant/components/media_source/models.py

export const resolvedMediaSchema = z.object({
  url: z.string(),
  mime_type: z.string(),
});
export type ResolvedMedia = z.infer<typeof resolvedMediaSchema>;

// *************************************************************************
//                     Home Assistant form types.
// *************************************************************************
// Home Assistant does not publish frontend types as a package, so the subset
// of the `ha-form` schema and `ha-selector` configuration shapes used by this
// card are declared here. They must remain structurally compatible with:
// https://github.com/home-assistant/frontend/blob/dev/src/components/ha-form/types.ts
// https://github.com/home-assistant/frontend/blob/dev/src/data/selector.ts

interface HAEntitySelector {
  entity: {
    domain?: string;
    multiple?: boolean;
  };
}

export interface HASelectSelectorOption {
  value: unknown;
  label: string;
}

export interface HASelectSelector {
  select: {
    mode?: 'dropdown' | 'list';
    multiple?: boolean;
    custom_value?: boolean;
    options: string[] | HASelectSelectorOption[];
  };
}

interface HAStringSelector {
  text: {
    type?: string;
  };
}

export interface HANumberSelector {
  number: {
    min?: number;
    max?: number;
    mode?: 'box' | 'slider';
    step?: number;
  };
}

interface HABooleanSelector {
  boolean: Record<string, never>;
}

interface HAIconSelector {
  icon: Record<string, never>;
}

interface HAObjectSelector {
  object: Record<string, never>;
}

type HASelector =
  | HABooleanSelector
  | HAEntitySelector
  | HAIconSelector
  | HANumberSelector
  | HAObjectSelector
  | HASelectSelector
  | HAStringSelector;

interface StockHAFormBaseSchema {
  name: string;
}

interface StockHAFormSelectorSchema extends StockHAFormBaseSchema {
  selector: HASelector;
}

interface StockHAFormExpandableSchema extends StockHAFormBaseSchema {
  type: 'expandable';
  title?: string;
  icon?: string;
  schema: readonly HAFormSchema[];
}

interface StockHAFormGridSchema extends StockHAFormBaseSchema {
  type: 'grid';

  // The width below which the columns fall back to one per row.
  column_min_width?: string;

  schema: readonly HAFormSchema[];
}

// Extensions layered onto the stock shapes; not part of `ha-form` itself.
interface CardHAFormSchemaExtensions {
  // Override the standard path-derived label, e.g. to point shared fields at
  // `config.common.*` rather than duplicating keys under each section.
  label?: string;
}

export interface HAFormSelectorSchema
  extends StockHAFormSelectorSchema,
    CardHAFormSchemaExtensions {}

export interface HAFormExpandableSchema
  extends Omit<StockHAFormExpandableSchema, 'name'>,
    CardHAFormSchemaExtensions {
  // hass-frontend requires `name`, but `ha-form`'s runtime treats a missing name
  // as a flattened, visual-only group (the `!item.name` paths in ha-form.ts).
  // Relaxed to optional here for nameless grouping, e.g. an "Engine" group over
  // the top-level `frigate`/`motioneye` camera keys.
  name?: string;

  // Explicit documentation-link path, for a nameless group whose link cannot be
  // derived from a configuration path.
  docPath?: string[];
}

// Fields laid out in columns rather than one per row. A grid is nameless like
// any other visual-only grouping, so the fields within it are stored where they
// would be without it.
export interface HAFormGridSchema
  extends Omit<StockHAFormGridSchema, 'name'>,
    CardHAFormSchemaExtensions {
  name?: string;
}

export type HAFormSchema =
  | HAFormSelectorSchema
  | HAFormExpandableSchema
  | HAFormGridSchema;

/**
 * Whether a form node is a field the user fills in, rather than a container of
 * further nodes. Recognized by the selector it carries, since `ha-form` gives a
 * field nothing else to tell it apart by.
 * @param schema The node's schema.
 * @returns `true` for a field.
 */
export const isFormFieldSchema = (
  schema: HAFormSchema,
): schema is HAFormSelectorSchema => 'selector' in schema;

/**
 * Whether a field takes a number. Recognized by the key naming the kind of
 * selector, which is all a selector carries to tell it apart by.
 * @param selector The field's selector.
 * @returns `true` for a number.
 */
export const isNumberFieldSelector = (
  selector: HASelector,
): selector is HANumberSelector => 'number' in selector;
