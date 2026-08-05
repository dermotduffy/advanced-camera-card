import {
  STATE_RUNNING,
  type Connection,
  type HassConfig,
  type HassEntities,
  type HassEntity,
  type MessageBase,
} from 'home-assistant-js-websocket';
import { mock } from 'vitest-mock-extended';

import type { Entity } from '../../src/ha/registry/entity/types';
import type { HomeAssistant } from '../../src/ha/types';
import { createRegistryEntity, createStateEntity } from '../test-utils';

// A WebSocket command handler. Returning a rejected promise models a command
// Home Assistant refuses; throwing models a malformed request.
export type WSCommandHandler = (message: MessageBase) => Promise<unknown> | unknown;

export interface FakeEntityOptions {
  state?: string;
  attributes?: Record<string, unknown>;
  lastChanged?: Date;
  lastUpdated?: Date;
}

export interface FakeHASSOptions {
  // Entities present from the start, as entity ID to state options (or a
  // bare state string).
  entities?: Record<string, FakeEntityOptions | string>;

  // Entity registry entries, as entity ID to a partial registry entry.
  registry?: Record<string, Partial<Entity>>;

  language?: string;
  isAdmin?: boolean;
}

// Home Assistant sends real timestamps, and the card measures a state's age
// against them: must use a dynamic (vs static) date.
const createDefaultTime = (): Date => new Date();

// `Auth` is a class built from real credentials, and `locale` is typed with
// ambient enums that have no runtime value, so neither can be constructed here.
// The card reads neither.
const { auth: INERT_AUTH, locale: INERT_LOCALE } = mock<HomeAssistant>();

const createConfig = (state: HassConfig['state']): HassConfig => ({
  latitude: 0,
  longitude: 0,
  elevation: 0,
  radius: 0,
  unit_system: {
    length: 'km',
    mass: 'kg',
    volume: 'L',
    temperature: '°C',
    pressure: 'Pa',
    wind_speed: 'km/h',
    accumulated_precipitation: 'mm',
  },
  location_name: 'Fake',
  time_zone: 'UTC',
  components: [],
  config_dir: '/config',
  allowlist_external_dirs: [],
  allowlist_external_urls: [],
  version: '2026.7.0',
  config_source: 'storage',
  recovery_mode: false,
  safe_mode: false,
  state,
  external_url: null,
  internal_url: null,
  currency: 'USD',
  country: null,
  language: 'en',
});

const createRegistryEntry = (entityID: string, overrides?: Partial<Entity>): Entity =>
  createRegistryEntity({ entity_id: entityID, unique_id: entityID, ...overrides });

/**
 * A driveable stand-in for the `hass` object the card is handed by Home
 * Assistant.
 *
 * Home Assistant updates immutably, and that is the behaviour reproduced here:
 * a change hands consumers a new top-level object and a new `states` map
 * holding a new state object for the entity that changed, while every other
 * entity keeps the object it already had. Anything the card can observe about
 * a real `hass` it must be able to observe about this one, so a divergence here
 * is a bug in the fake rather than a shortcut worth taking.
 */
export class FakeHASS {
  private _hass: HomeAssistant;
  private _states: HassEntities = {};
  private _registry = new Map<string, Entity>();
  private _config: HassConfig = createConfig(STATE_RUNNING);
  private _connected = true;
  private _connection: Connection;
  private _language: string;
  private _isAdmin: boolean;
  private _handlers = new Map<string, WSCommandHandler>();
  private _commandLog: MessageBase[] = [];
  private _openEventSubscriptions = 0;

  constructor(options?: FakeHASSOptions) {
    this._language = options?.language ?? 'en';
    this._isAdmin = options?.isAdmin ?? true;

    for (const [entityID, entityOptions] of Object.entries(options?.entities ?? {})) {
      this._states[entityID] = this._createEntity(entityID, entityOptions);
    }
    for (const [entityID, entry] of Object.entries(options?.registry ?? {})) {
      this._registry.set(entityID, createRegistryEntry(entityID, entry));
    }

    this._connection = this._createConnection();
    this._registerDefaultHandlers();
    this._hass = this._createHASS();
  }

  public getHASS(): HomeAssistant {
    return this._hass;
  }

  /**
   * Register a handler for a WebSocket command, replacing any existing one.
   */
  public registerCommand(type: string, handler: WSCommandHandler): void {
    this._handlers.set(type, handler);
  }

  /**
   * Number of event subscriptions not yet released.
   */
  public getOpenEventSubscriptionCount(): number {
    return this._openEventSubscriptions;
  }

  /**
   * Every WebSocket command the card has issued, in order.
   */
  public getCommandLog(): readonly MessageBase[] {
    return this._commandLog;
  }

  /**
   * Change one entity, then renew. The changed entity gets a new state object;
   * every other entity keeps the one it already had.
   */
  public setState(entityID: string, options: FakeEntityOptions | string): void {
    this._states = {
      ...this._states,
      [entityID]: this._createEntity(entityID, options),
    };
    this._renew();
  }

  /**
   * Remove an entity from the state map, as happens when its integration is
   * unloaded.
   */
  public removeState(entityID: string): void {
    const states = { ...this._states };
    delete states[entityID];
    this._states = states;
    this._renew();
  }

  /**
   * Replace the `hass` object without changing any entity, as Home Assistant
   * does constantly. Every entity keeps its identity, so a card that re-does
   * work after this is reacting to the object rather than to what is in it.
   */
  public renew(): void {
    this._renew();
  }

  /**
   * Drop or restore the WebSocket, as a Home Assistant restart does. Home
   * Assistant keeps handing the card a `hass` while it is disconnected, which
   * is why this renews rather than going silent.
   */
  public setConnected(connected: boolean): void {
    this._connected = connected;
    this._renew();
  }

  private _createEntity(
    entityID: string,
    options: FakeEntityOptions | string,
  ): HassEntity {
    const resolved: FakeEntityOptions =
      typeof options === 'string' ? { state: options } : options;

    return createStateEntity({
      entity_id: entityID,
      state: resolved.state ?? 'unknown',
      attributes: resolved.attributes ?? {},
      last_changed: (resolved.lastChanged ?? createDefaultTime()).toISOString(),
      last_updated: (resolved.lastUpdated ?? createDefaultTime()).toISOString(),
      context: { id: entityID, user_id: null, parent_id: null },
    });
  }

  private _renew(): void {
    this._hass = this._createHASS();
  }

  private _createConnection(): Connection {
    const connection = mock<Connection>();
    connection.subscribeMessage.mockResolvedValue(() => Promise.resolve());
    connection.subscribeEvents.mockImplementation(async () => {
      this._openEventSubscriptions++;
      return () => {
        this._openEventSubscriptions--;
        return Promise.resolve();
      };
    });

    // `callWS` and `sendMessagePromise` are the same request/response channel,
    // so both go through one handler table. Given two tables, a command
    // registered by a test would be silently ignored for any caller that
    // reached the connection directly.
    connection.sendMessagePromise.mockImplementation((message) => this._callWS(message));
    return connection;
  }

  private _registerDefaultHandlers(): void {
    this.registerCommand('config/entity_registry/get', (message) => {
      const entry = this._registry.get(String(message.entity_id));
      if (!entry) {
        return Promise.reject(
          new Error(`Entity not found in the fake registry: ${message.entity_id}`),
        );
      }
      return entry;
    });
    this.registerCommand('config/entity_registry/list', () => [
      ...this._registry.values(),
    ]);
    this.registerCommand('lovelace/resources', () => []);

    // Not a card command: `ha-nunjucks` fetches the label registry once when a
    // template first renders.
    this.registerCommand('config/label_registry/list', () => []);
  }

  private async _callWS<T>(message: MessageBase): Promise<T> {
    this._commandLog.push(message);
    const handler = this._handlers.get(message.type);
    if (!handler) {
      // Loudly, because a card that starts issuing a new command must not
      // appear to work against a fake that knows nothing about it.
      throw new Error(`FakeHASS received an unregistered WS command: ${message.type}`);
    }

    // A WebSocket response is untyped on the wire, and the caller's generic is
    // its claim about the shape. Callers parse what they get with Zod, so a
    // handler returning the wrong shape surfaces there.
    return (await handler(message)) as unknown as T;
  }

  private _unsupported(name: string): () => never {
    return () => {
      throw new Error(`FakeHASS does not implement ${name}`);
    };
  }

  private _createHASS(): HomeAssistant {
    return {
      auth: INERT_AUTH,
      locale: INERT_LOCALE,

      states: this._states,
      config: this._config,
      connected: this._connected,
      connection: this._connection,
      language: this._language,
      selectedLanguage: null,
      selectedTheme: null,
      resources: {},
      services: {},
      themes: {
        default_theme: 'default',
        themes: {},
      },
      panels: {},
      panelUrl: 'lovelace',
      translationMetadata: { fragments: [], translations: {} },
      dockedSidebar: false,
      moreInfoEntityId: '',
      user: {
        id: 'fake-user',
        is_owner: this._isAdmin,
        is_admin: this._isAdmin,
        name: 'Fake User',
        credentials: [],
        mfa_modules: [],
      },

      callWS: (message) => this._callWS(message),
      hassUrl: (path?: string) => new URL(path ?? '/', window.location.href).href,
      localize: (key: string) => key,

      // Everything the card can call has to either work or fail loudly. A
      // method that quietly returns nothing would let a card start depending on
      // it without any test noticing.
      callService: this._unsupported('callService'),
      callApi: this._unsupported('callApi'),
      fetchWithAuth: this._unsupported('fetchWithAuth'),
      sendWS: this._unsupported('sendWS'),
    };
  }
}
