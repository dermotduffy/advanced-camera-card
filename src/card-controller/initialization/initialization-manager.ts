import PQueue from 'p-queue';

import { sideLoadHomeAssistantElements } from '../../ha/side-load-ha-elements';
import { loadLanguages } from '../../localize/localize';
import { errorToConsole } from '../../utils/basic';
import { Initializer } from '../../utils/initializer/initializer';
import type { CardInitializerAPI } from '../types';
import { SessionManager, SessionState } from './session-manager';

export enum InitializationAspect {
  LANGUAGES = 'languages',
  SIDE_LOAD_ELEMENTS = 'side-load-elements',
  CAMERAS = 'cameras',
  MICROPHONE_CONNECT = 'microphone-connect',
  TEMPLATE_RENDERER = 'template-renderer',
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

  // Tracks an "initialization session" (the "useful" card time between full
  // readiness -> disconnection of various kinds).
  private _sessionManager: SessionManager;

  constructor(
    api: CardInitializerAPI,
    initializer?: Initializer,
    sessionManager?: SessionManager,
  ) {
    this._api = api;
    this._initializer = initializer ?? new Initializer();
    this._sessionManager = sessionManager ?? new SessionManager(api);
  }

  public getSessionManager(): SessionManager {
    return this._sessionManager;
  }

  public isInitialized(aspect: InitializationAspect): boolean {
    return this._initializer.isInitialized(aspect);
  }

  public areMandatoryAspectsInitialized(): boolean {
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
      ...(this._api.getConfigManager().hasTemplate()
        ? [InitializationAspect.TEMPLATE_RENDERER]
        : []),
      InitializationAspect.VIEW,
      InitializationAspect.INITIAL_TRIGGER,
    ]);
  }

  // The one place that decides whether to (re)start mandatory initialization,
  // so callers don't check the conditions themselves. Called on every render
  // (from the card's shouldUpdate) and whenever hass changes (from
  // HASSManager); a reconnect or a cleared issue reaches it by causing a
  // render.
  //
  // The check here is a filter rather than the decision: a card that has
  // finished initializing re-renders often, and without it each of those
  // renders would queue an attempt that does nothing.
  public triggerInitialization(): void {
    if (!this._shouldInitializeMandatory()) {
      return;
    }
    void this.initializeMandatory();
  }

  private _shouldInitializeMandatory(): boolean {
    return (
      this._api.getConfigManager().hasConfig() &&
      this._api.getCardElementManager().isConnected() &&
      this._api.getHASSManager().isReady() &&
      // Start when aspects remain to be initialized, or when the session is
      // idle even though aspects are otherwise initialized. A run that
      // initialized every aspect and then declined (e.g. because something
      // ended its session), reports no outcome at all, so only a later run can
      // report the card as actually started, and that run will find nothing
      // left to initialize.
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/2672
      (!this.areMandatoryAspectsInitialized() ||
        this._sessionManager.getState() === SessionState.IDLE) &&
      // Don't start while a full-card issue (e.g. the "Home Assistant is
      // starting" notice) is shown: each initialization step aborts as soon as
      // it sees one, so an attempt now would be wasted. The card tries again
      // once the issue clears.
      !this._api.getIssueManager().getStateManager().hasFullCardIssue()
    );
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

    // The authoritative check, made when the attempt actually runs rather than
    // when it was queued: an attempt can sit in the queue behind another one,
    // and the card may be detached, lose Home Assistant, or finish initializing
    // while it waits. This is what stops a stale attempt running.
    //
    // Readiness itself is asked of the HASS manager, whose RUNNING requirement
    // waits out a Home Assistant that is still loading integrations, against
    // which integration-specific WS calls fail with "Unknown command".
    if (!hass || !this._shouldInitializeMandatory()) {
      return;
    }

    const token = this._sessionManager.startInitialization();

    if (
      !(await this._runStep(token, () =>
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

    // The configuration may have vanished during the await above. The CAMERAS
    // initializer returns void and quietly does nothing without a
    // configuration, which would mark the aspect initialized against nothing
    // -- so stop before it runs.
    if (!this._api.getConfigManager().hasConfig()) {
      this._sessionManager.reportInitializationDeclined(token);
      return;
    }

    if (
      !(await this._runStep(token, () =>
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

          // Unrendered templates could cause correctness issues -- ensure the
          // template rendered is loaded before it is needed.
          ...(this._api.getConfigManager().hasTemplate() && {
            [InitializationAspect.TEMPLATE_RENDERER]: async () => {
              await this._api.getTemplateManager().loadRenderer();
            },
          }),
        }),
      ))
    ) {
      return;
    }

    if (
      !(await this._runStep(token, () =>
        this._initializer.initializeIfNecessary(
          InitializationAspect.VIEW,
          this._api.getViewManager().initialize,
        ),
      ))
    ) {
      return;
    }

    if (
      !(await this._runStep(token, () =>
        this._initializer.initializeIfNecessary(
          InitializationAspect.INITIAL_TRIGGER,
          async () => {
            await this._api.getCameraTriggersManager().handleInitialCameraTriggers();

            // Force a card update to continue the initialization.
            this._api.getCardElementManager().update();
          },
        ),
      ))
    ) {
      return;
    }

    // The config is read here, at the last moment, so the card is never
    // reported as started against a configuration that a change during the
    // awaits above has already replaced. It is written to condition state here,
    // rather than by the ConfigManager, to ensure actions (that trigger on
    // config change) are not run before hass is available and the card is
    // initialized (the first config is set in the card *before* hass is set in
    // the card).
    const config = this._api.getConfigManager().getConfig();
    if (
      !config ||
      !this._sessionManager.isCurrentInitialization(token) ||
      !this.areMandatoryAspectsInitialized()
    ) {
      this._sessionManager.reportInitializationDeclined(token);
      return;
    }

    // Subscribe any automations now: the template renderer (a mandatory
    // automation trigger evaluators can baseline pre-trigger (which potentially
    // involves rendering templates). This must run before the report below so
    // that triggers watching `config`/`initialized` are attached in time to
    // fire on *that* very change.
    this._api.getAutomationsManager().subscribe();

    this._sessionManager.reportInitializationSucceeded(token, config);

    this._api.getCardElementManager().update();
  }

  // Run one step of initialization, telling the session manager the outcome and
  // returning whether the remaining steps should run.
  //
  // A step "declines" when it raises no error of its own but yet the
  // initialization process should not continue.
  private async _runStep(token: number, fn: () => Promise<boolean>): Promise<boolean> {
    let initialized = false;
    try {
      initialized = await fn();
    } catch (e: unknown) {
      if (this._sessionManager.isCurrentInitialization(token)) {
        if (e instanceof Error) {
          errorToConsole(e);
        }
        this._api.getIssueManager().trigger('initialization', { error: e });
        this._sessionManager.reportInitializationFailed(token);
      }
      return false;
    }

    if (
      !initialized ||
      this._api.getIssueManager().getStateManager().hasFullCardIssue()
    ) {
      this._sessionManager.reportInitializationDeclined(token);
      return false;
    }

    return true;
  }

  public invalidateAspect(aspect: InitializationAspect): void {
    this._initializer.uninitialize(aspect);
  }

  // Mark every mandatory aspect uninitialized, so a fresh initialization starts
  // from nothing. Which aspects those are is this class's own question -- see
  // `areMandatoryAspectsInitialized()`.
  public invalidateMandatoryAspects(): void {
    for (const aspect of [
      InitializationAspect.CAMERAS,
      InitializationAspect.MICROPHONE_CONNECT,
      InitializationAspect.TEMPLATE_RENDERER,
      InitializationAspect.VIEW,
      InitializationAspect.INITIAL_TRIGGER,
    ]) {
      this._initializer.uninitialize(aspect);
    }
  }
}
