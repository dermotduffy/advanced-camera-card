import { LitElement, ReactiveControllerHost } from 'lit';
import { ActionEventTarget } from '../action-handler-directive';
import { isCardInPanel } from '../ha/panel';
import { setOrRemoveAttribute } from '../utils/basic';
import { isBeingCasted } from '../utils/casting';
import { ActionExecutionRequestEventTarget } from './actions/utils/execution-request';
import { InitializationAspect } from './initialization-manager';
import { CardElementAPI } from './types';

export type ScrollCallback = () => void;
export type MenuToggleCallback = () => void;

export type CardHTMLElement = LitElement &
  ReactiveControllerHost &
  ActionEventTarget &
  ActionExecutionRequestEventTarget;

export class CardElementManager {
  protected _api: CardElementAPI;

  protected _element: CardHTMLElement;
  protected _scrollCallback: ScrollCallback;
  protected _menuToggleCallback: MenuToggleCallback;

  constructor(
    api: CardElementAPI,
    element: CardHTMLElement,
    scrollCallback: ScrollCallback,
    menuToggleCallback: MenuToggleCallback,
  ) {
    this._api = api;

    this._element = element;
    this._scrollCallback = scrollCallback;
    this._menuToggleCallback = menuToggleCallback;
  }

  public getElement(): HTMLElement {
    return this._element;
  }

  public scrollReset(): void {
    this._scrollCallback();
  }

  public toggleMenu(): void {
    this._menuToggleCallback();
  }

  public update = (): void => {
    this._element.requestUpdate();
  };

  public hasUpdated(): boolean {
    return this._element.hasUpdated;
  }

  public elementConnected(): void {
    // Set initial condition state. Must be done after the element is connected to
    // allow callbacks to interact with the card.
    this._api.getInteractionManager().initialize();
    this._api.getFullscreenManager().initialize();
    this._api.getExpandManager().initialize();
    this._api.getMediaLoadedInfoManager().initialize();
    this._api.getMicrophoneManager().initialize();
    this._api.getKeyboardStateManager().initialize();

    // These initializers are called when the config is updated, but on initial
    // creation of the card hass is not yet available when the config is first
    // loaded.
    this._api.getDefaultManager().initialize();
    this._api.getMediaPlayerManager().initialize();

    this._api
      .getHASSManager()
      .getStateWatcher()
      ?.subscribe(this.update, [
        ...(this._api.getConfigManager().getConfig()?.view.render_entities ?? []),

        // Refresh the card if media player state changes:
        // https://github.com/dermotduffy/advanced-camera-card/issues/881
        ...(this._api.getMediaPlayerManager().getMediaPlayers() ?? []),
      ]);

    // Whether or not the card is in panel mode on the dashboard.
    setOrRemoveAttribute(this._element, isCardInPanel(this._element), 'panel');
    setOrRemoveAttribute(this._element, isBeingCasted(), 'casted');

    this._api.getFullscreenManager().connect();

    this._element.addEventListener(
      'mousemove',
      this._api.getInteractionManager().reportInteraction,
    );
    this._element.addEventListener(
      'wheel',
      this._api.getInteractionManager().reportInteraction,
    );
    this._element.addEventListener(
      'll-custom',
      this._api.getActionsManager().handleCustomActionEvent,
    );
    this._element.addEventListener(
      'action',
      this._api.getActionsManager().handleInteractionEvent,
    );
    this._element.addEventListener(
      'action',
      this._api.getInteractionManager().reportInteraction,
    );
    this._element.addEventListener(
      'advanced-camera-card:action:execution-request',
      this._api.getActionsManager().handleActionExecutionRequestEvent,
    );

    // Listen for HA `navigate` actions.
    // See: https://github.com/home-assistant/frontend/blob/273992c8e9c3062c6e49481b6d7d688a07067232/src/common/navigate.ts#L43
    window.addEventListener(
      'location-changed',
      this._api.getQueryStringManager().requestExecution,
    );

    // Listen for history state changes (i.e. user using the browser
    // back/forward controls).
    window.addEventListener(
      'popstate',
      this._api.getQueryStringManager().requestExecution,
    );

    this._api.getConditionStateManager()?.setState({
      userAgent: navigator.userAgent,
    });

    // Manually request query string execute as the card will be
    // disconnected/reconnected when dashboard 'tab' changes happen within HA.
    this._api.getQueryStringManager().requestExecution();

    // Make sure reconnections call the initialization code.
    this._element.requestUpdate();
  }

  public elementDisconnected(): void {
    setOrRemoveAttribute(this._element, false, 'panel');
    setOrRemoveAttribute(this._element, false, 'tabindex');
    setOrRemoveAttribute(this._element, false, 'casted');

    // When the dashboard 'tab' is changed, the media is effectively unloaded.
    this._api.getMediaLoadedInfoManager().clear();
    this._api.getFullscreenManager().disconnect();
    this._api.getKeyboardStateManager().uninitialize();
    this._api.getActionsManager().uninitialize();
    this._api.getDefaultManager().uninitialize();
    this._api.getHASSManager().getStateWatcher()?.unsubscribe(this.update);

    // Uninitialize cameras to cause them to reinitialize on
    // reconnection, to ensure the state subscription/unsubscription works
    // correctly for triggers.
    this._api.getInitializationManager().uninitialize(InitializationAspect.CAMERAS);
    this._api.getCameraManager().destroy();

    this._element.removeEventListener(
      'mousemove',
      this._api.getInteractionManager().reportInteraction,
    );
    this._element.removeEventListener(
      'wheel',
      this._api.getInteractionManager().reportInteraction,
    );
    this._element.removeEventListener(
      'll-custom',
      this._api.getActionsManager().handleCustomActionEvent,
    );
    this._element.removeEventListener(
      'action',
      this._api.getActionsManager().handleInteractionEvent,
    );
    this._element.removeEventListener(
      'action',
      this._api.getInteractionManager().reportInteraction,
    );
    this._element.removeEventListener(
      'advanced-camera-card:action:execution-request',
      this._api.getActionsManager().handleActionExecutionRequestEvent,
    );

    window.removeEventListener(
      'location-changed',
      this._api.getQueryStringManager().requestExecution,
    );
    window.removeEventListener(
      'popstate',
      this._api.getQueryStringManager().requestExecution,
    );
  }
}
