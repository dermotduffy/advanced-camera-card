import { STATE_RUNNING } from 'home-assistant-js-websocket';
import PQueue from 'p-queue';
import { sideLoadHomeAssistantElements } from '../ha/side-load-ha-elements';
import { loadLanguages } from '../localize/localize';
import { errorToConsole } from '../utils/basic';
import { Initializer } from '../utils/initializer/initializer';
import { CardInitializerAPI } from './types';

export enum InitializationAspect {
  LANGUAGES = 'languages',
  SIDE_LOAD_ELEMENTS = 'side-load-elements',
  CAMERAS = 'cameras',
  MICROPHONE_CONNECT = 'microphone-connect',
  VIEW = 'view',

  // The initial triggering must happen after both the config is set (and
  // cameras initialized), and hass is set.
  INITIAL_TRIGGER = 'initial-trigger',
}

// =========================================================================
// Rules for initialization. Initializers must be reentrant as these situations
// may occur:
//
// 1. Multiple JS async contexts may execute these functions at the same time.
// 2. At any point, something may uninitialize a part of the card (including
//    while a different async context is in the middle of running the
//    initialization method).
// =========================================================================

export class InitializationManager {
  private _api: CardInitializerAPI;

  // A concurrency limit is placed to ensure that on card load multiple async
  // contexts do not attempt to initialize the card at the same time. This is
  // not strictly necessary, just more efficient, as long as the "Rules for
  // initialization" (above) are followed.
  private _initializationQueue = new PQueue({ concurrency: 1 });
  private _initializer: Initializer;
  private _everInitialized = false;

  constructor(api: CardInitializerAPI, initializer?: Initializer) {
    this._api = api;
    this._initializer = initializer ?? new Initializer();
  }

  public wasEverInitialized(): boolean {
    return this._everInitialized;
  }

  public isInitialized(aspect: InitializationAspect): boolean {
    return this._initializer.isInitialized(aspect);
  }

  public isInitializedMandatory(): boolean {
    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      return false;
    }

    return this._initializer.isInitializedMultiple([
      InitializationAspect.LANGUAGES,
      InitializationAspect.SIDE_LOAD_ELEMENTS,
      InitializationAspect.CAMERAS,
      ...(this._api.getMicrophoneManager().shouldConnectOnInitialization()
        ? [InitializationAspect.MICROPHONE_CONNECT]
        : []),
      InitializationAspect.VIEW,
      InitializationAspect.INITIAL_TRIGGER,
    ]);
  }

  /**
   * Initialize the hard requirements for rendering anything.
   * @returns `true` if card rendering can continue.
   */
  public async initializeMandatory(): Promise<void> {
    await this._initializationQueue.add(() => this._initializeMandatory());
  }

  private async _initializeMandatory(): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();
    if (!hass || this.isInitializedMandatory()) {
      return;
    }

    // Wait until HA has finished loading integrations before attempting init.
    // Otherwise integration-specific WS calls (e.g. Frigate event
    // subscriptions) fail with "Unknown command" against a half-loaded HA. The
    // HASSManager will trigger another init attempt as soon as
    // hass.config.state transitions to RUNNING.
    if (hass.config?.state !== STATE_RUNNING) {
      return;
    }

    if (
      !(await this._tryInitialize(() =>
        this._initializer.initializeMultipleIfNecessary({
          // Caution: Ensure nothing in this set of initializers requires
          // config or languages since they will not yet have been initialized.
          [InitializationAspect.LANGUAGES]: async () => {
            await loadLanguages(hass);
          },
          [InitializationAspect.SIDE_LOAD_ELEMENTS]: async () => {
            await sideLoadHomeAssistantElements();
          },
        }),
      ))
    ) {
      return;
    }

    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      return;
    }

    if (
      !(await this._tryInitialize(() =>
        this._initializer.initializeMultipleIfNecessary({
          [InitializationAspect.CAMERAS]: async () => {
            // Recreate the camera manager to guarantee an immediate re-render.
            // See: https://github.com/dermotduffy/advanced-camera-card/issues/1811
            // See: https://github.com/dermotduffy/advanced-camera-card/issues/1769
            this._api.createCameraManager();
            await this._api.getCameraManager().initializeCamerasFromConfig();
          },

          // Connecting the microphone (if configured) is considered mandatory to
          // avoid issues with some cameras that only allow 2-way audio on the
          // first stream initialized.
          // See: https://github.com/dermotduffy/advanced-camera-card/issues/1235
          ...(this._api.getMicrophoneManager().shouldConnectOnInitialization() && {
            [InitializationAspect.MICROPHONE_CONNECT]: async () => {
              // Recreate the microphone manager to guarantee an immediate
              // re-render.
              this._api.createMicrophoneManager();
              await this._api.getMicrophoneManager().connect();
            },
          }),
        }),
      ))
    ) {
      return;
    }

    if (
      !(await this._tryInitialize(() =>
        this._initializer.initializeIfNecessary(
          InitializationAspect.VIEW,
          this._api.getViewManager().initialize,
        ),
      ))
    ) {
      return;
    }

    if (
      !(await this._tryInitialize(() =>
        this._initializer.initializeIfNecessary(
          InitializationAspect.INITIAL_TRIGGER,
          async () => {
            await this._api.getTriggersManager().handleInitialCameraTriggers();

            // Force a card update to continue the initialization.
            this._api.getCardElementManager().update();
          },
        ),
      ))
    ) {
      return;
    }

    this._everInitialized = true;

    // When the card is initialized, both the initialization state (will never
    // change again), and the config are set in the condition state. The
    // config is set here, rather than in the ConfigManager, in order to
    // ensure actions (that trigger on config change) are not run before hass
    // is available and the card is initialzied (the first config is set in
    // the card *before* hass is set in the card).
    this._api.getConditionStateManager().setState({
      config: config,
      initialized: this._everInitialized,
    });

    this._api.getCardElementManager().update();
  }

  private async _tryInitialize(fn: () => Promise<void>): Promise<boolean> {
    try {
      await fn();
    } catch (e: unknown) {
      if (e instanceof Error) {
        errorToConsole(e);
      }
      this._setInitializationIssue(e);
      return false;
    }

    if (this._api.getIssueManager().getStateManager().hasFullCardIssue()) {
      return false;
    }

    return true;
  }

  private _setInitializationIssue(error: unknown): void {
    this._api.getIssueManager().trigger('initialization', { error });
  }

  public uninitialize(aspect: InitializationAspect): void {
    // Destroying the camera manager when uninitializing CAMERAS releases held
    // resources (WebSocket subscriptions via hass.connection.subscribeMessage,
    // event listeners) before the CAMERAS init aspect replaces the instance
    // via createCameraManager(). Without this, dropping the reference leaks
    // those subscriptions.
    if (aspect === InitializationAspect.CAMERAS) {
      this._api.getCameraManager().destroy();
    }
    this._initializer.uninitialize(aspect);
  }

  public uninitializeMandatory(): void {
    for (const aspect of [
      InitializationAspect.CAMERAS,
      InitializationAspect.MICROPHONE_CONNECT,
      InitializationAspect.VIEW,
      InitializationAspect.INITIAL_TRIGGER,
    ]) {
      this.uninitialize(aspect);
    }
  }
}
