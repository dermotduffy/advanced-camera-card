import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { Ref, createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import 'web-dialog';
import { actionHandler } from './action-handler-directive.js';
import { CardController } from './card-controller/controller';
import { MenuButtonController } from './components-lib/menu-button-controller';
import './components/elements.js';
import { AdvancedCameraCardElements } from './components/elements.js';
import './components/loading.js';
import './components/menu.js';
import { AdvancedCameraCardMenu } from './components/menu.js';
import './components/message.js';
import { renderMessage } from './components/message.js';
import './components/overlay.js';
import { AdvancedCameraCardOverlay } from './components/overlay.js';
import './components/status-bar';
import './components/thumbnail-carousel.js';
import './components/views.js';
import { AdvancedCameraCardViews } from './components/views.js';
import { ConditionStateManagerGetEvent } from './conditions/state-manager-via-event.js';
import { StatusBarItem } from './config/schema/actions/types.js';
import { MenuItem } from './config/schema/elements/custom/menu/types.js';
import { AdvancedCameraCardConfig } from './config/schema/types.js';
import { RawAdvancedCameraCardConfig } from './config/types.js';
import { REPO_URL } from './const.js';
import { HomeAssistant, LovelaceCardEditor } from './ha/types.js';
import { localize } from './localize/localize.js';
import cardStyle from './scss/card.scss';
import { MediaLoadedInfo, Message } from './types.js';
import { hasAction } from './utils/action.js';
import { getReleaseVersion } from './utils/diagnostics';

// ***************************************************************************
//                         General Card-Wide Notes
// ***************************************************************************

/** Media callbacks:
 *
 * Media elements (e.g. <video>, <img> or <canvas>) need to callback when:
 *  - Metadata is loaded / dimensions are known (for aspect-ratio)
 *  - Media is playing / paused (to avoid reloading)
 *
 * A number of different approaches used to attach event handlers to
 * get these callbacks (which need to be attached directly to the media
 * elements, which may be 'buried' down the DOM):
 *  - Extend the `ha-hls-player` and `ha-camera-stream` to specify the required
 *    hooks (as querySelecting the media elements after rendering was a fight
 *    with the Lit rendering engine and was very fragile) .
 *  - For non-Lit elements (e.g. WebRTC) query selecting after rendering.
 *  - Library provided hooks (e.g. JSMPEG)
 *  - Directly specifying hooks (e.g. for snapshot viewing with simple <img> tags)
 */

// ***************************************************************************
//                          Static Initializers
// ***************************************************************************

console.info(
  `%c 📷 Advanced Camera Card %c ${getReleaseVersion()} `,
  'padding: 3px; color: black; background: pink;',
  'padding: 3px; color: black; background: white;',
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).customCards = (window as any).customCards || [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).customCards.push({
  type: 'advanced-camera-card',
  name: localize('common.advanced_camera_card'),
  description: localize('common.advanced_camera_card_description'),
  preview: true,
  documentationURL: REPO_URL,
});

// ***************************************************************************
//                    Main AdvancedCameraCard WebComponent
//
// Any non-rendering / non-lit related functionality should be added to
// CardController instead of this file.
// ***************************************************************************

@customElement('advanced-camera-card')
class AdvancedCameraCard extends LitElement {
  protected _controller = new CardController(
    this,
    // Callback to scroll the main pane back to the top (example usecase: scrolling
    // half way down the gallery, then viewing diagnostics should result in
    // diagnostics starting at the top).
    () => this._refMain.value?.scroll({ top: 0 }),
    () => this._refMenu.value?.toggleMenu(),
  );

  protected _menuButtonController = new MenuButtonController();

  protected _refMenu: Ref<AdvancedCameraCardMenu> = createRef();
  protected _refOverlay: Ref<AdvancedCameraCardOverlay> = createRef();
  protected _refMain: Ref<HTMLElement> = createRef();
  protected _refElements: Ref<AdvancedCameraCardElements> = createRef();
  protected _refViews: Ref<AdvancedCameraCardViews> = createRef();

  // Convenience methods for very frequently accessed attributes.
  get _config(): AdvancedCameraCardConfig | null {
    return this._controller.getConfigManager().getConfig();
  }

  get _hass(): HomeAssistant | null {
    return this._controller.getHASSManager().getHASS();
  }

  set hass(hass: HomeAssistant) {
    this._controller.getHASSManager().setHASS(hass);

    // Manually set hass in the menu, elements and image. This is to allow these
    // to update, without necessarily re-rendering the entire card (re-rendering
    // is expensive).
    if (this._refMenu.value) {
      this._refMenu.value.hass = hass;
    }
    if (this._refElements.value) {
      this._refElements.value.hass = hass;
    }
    if (this._refViews.value) {
      this._refViews.value.hass = hass;
    }
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return await CardController.getConfigElement();
  }

  public static getStubConfig(
    _: HomeAssistant,
    entities: string[],
  ): AdvancedCameraCardConfig {
    return CardController.getStubConfig(entities);
  }

  public setConfig(config: RawAdvancedCameraCardConfig): void {
    this._controller.getConfigManager().setConfig(config);
  }

  protected shouldUpdate(): boolean {
    // Do not allow a disconnected element to update, as it may cause cameras to
    // reinitialize/subscribe for an element that is no longer part of the
    // document.
    if (!this.isConnected) {
      return false;
    }

    // Always allow messages to render, as a message may be generated during
    // initialization.
    if (this._controller.getMessageManager().hasMessage()) {
      return true;
    }

    if (!this._controller.getInitializationManager().isInitializedMandatory()) {
      this._controller.getInitializationManager().initializeMandatory();
    }
    return true;
  }

  protected _renderMenuStatusContainer(
    position: 'top' | 'bottom' | 'overlay',
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    const menuStyle = this._config.menu.style;
    const menuPosition = this._config.menu.position;
    const statusBarStyle = this._config.status_bar.style;
    const statusBarPosition = this._config.status_bar.position;

    if (
      // If there's nothing to render...
      (menuStyle === 'none' && statusBarStyle === 'none') ||
      // ... or the position I'm rendering does not contain the menu/status bar
      (position === 'overlay' &&
        menuStyle === 'outside' &&
        statusBarStyle === 'outside') ||
      (position !== 'overlay' &&
        (menuStyle !== 'outside' || menuPosition !== position) &&
        (statusBarStyle !== 'outside' || statusBarPosition !== position))
    ) {
      // ... then there's nothing to do.
      return;
    }

    const getContents = (kind: 'overlay' | 'outerlay'): TemplateResult => {
      const shouldRenderMenu =
        menuStyle !== 'none' &&
        ((menuStyle === 'outside' && kind === 'outerlay' && menuPosition === position) ||
          (menuStyle !== 'outside' && kind === 'overlay'));

      const shouldRenderStatusBar =
        statusBarStyle !== 'none' &&
        ((statusBarStyle === 'outside' &&
          kind === 'outerlay' &&
          statusBarPosition === position) ||
          (statusBarStyle !== 'outside' && kind === 'overlay'));

      // Complex logic to try to always put the menu in the right-looking place.
      const renderMenuFirst =
        menuPosition === 'left' ||
        menuPosition === 'right' ||
        (menuPosition === 'bottom' &&
          menuStyle === 'hidden' &&
          statusBarStyle !== 'popup') ||
        (menuPosition === 'top' && statusBarStyle === 'popup');

      return html`
        ${shouldRenderMenu && renderMenuFirst ? this._renderMenu(menuPosition) : ''}
        ${shouldRenderStatusBar ? this._renderStatusBar(statusBarPosition) : ''}
        ${shouldRenderMenu && !renderMenuFirst ? this._renderMenu(menuPosition) : ''}
      `;
    };

    return html`
      ${position === 'overlay'
        ? html`<advanced-camera-card-overlay
            >${getContents('overlay')}</advanced-camera-card-overlay
          >`
        : html`<div class="outerlay" data-position="${position}">
            ${getContents('outerlay')}
          </div>`}
    `;
  }

  protected _renderMenu(slot?: string): TemplateResult | void {
    const view = this._controller.getViewManager().getView();
    if (!this._hass || !this._config) {
      return;
    }
    return html`
      <advanced-camera-card-menu
        ${ref(this._refMenu)}
        slot=${ifDefined(slot)}
        .hass=${this._hass}
        .menuConfig=${this._config.menu}
        .buttons=${this._menuButtonController.calculateButtons(
          this._hass,
          this._config,
          this._controller.getCameraManager(),
          {
            inExpandedMode: this._controller.getExpandManager().isExpanded(),
            fullscreenManager: this._controller.getFullscreenManager(),
            currentMediaLoadedInfo: this._controller.getMediaLoadedInfoManager().get(),
            showCameraUIButton: this._controller.getCameraURLManager().hasCameraURL(),
            mediaPlayerController: this._controller.getMediaPlayerManager(),
            microphoneManager: this._controller.getMicrophoneManager(),
            view: view,
            viewManager: this._controller.getViewManager(),
          },
        )}
        .entityRegistryManager=${this._controller.getEntityRegistryManager()}
      ></advanced-camera-card-menu>
    `;
  }

  protected _renderStatusBar(slot?: string): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <advanced-camera-card-status-bar
        slot=${ifDefined(slot)}
        .items=${this._controller.getStatusBarItemManager().calculateItems({
          statusConfig: this._config.status_bar,
          cameraManager: this._controller.getCameraManager(),
          view: this._controller.getViewManager().getView(),
          mediaLoadedInfo: this._controller.getMediaLoadedInfoManager().get(),
        })}
        .config=${this._config.status_bar}
      ></advanced-camera-card-status-bar>
    `;
  }

  protected updated(): void {
    if (this._controller.getInitializationManager().isInitializedMandatory()) {
      this._controller.getQueryStringManager().executeIfNecessary();
    }
  }

  protected _renderInDialogIfNecessary(contents: TemplateResult): TemplateResult | void {
    if (this._controller.getExpandManager().isExpanded()) {
      return html` <web-dialog
        open
        center
        @close=${() => {
          this._controller.getExpandManager().setExpanded(false);
        }}
      >
        ${contents}
      </web-dialog>`;
    } else {
      return contents;
    }
  }

  protected render(): TemplateResult | void {
    if (!this._hass) {
      return;
    }

    const outerlayUsed =
      this._config?.menu.style === 'outside' ||
      this._config?.status_bar.style === 'outside';

    const mainClasses = {
      main: true,
      'curve-top':
        !outerlayUsed ||
        (this._config?.menu.position !== 'top' &&
          this._config?.status_bar.position !== 'top'),
      'curve-bottom':
        !outerlayUsed ||
        (this._config?.menu.position !== 'bottom' &&
          this._config?.status_bar.position !== 'bottom'),
    };

    const actions = this._controller.getActionsManager().getMergedActions();
    const cameraManager = this._controller.getCameraManager();

    const showLoading =
      this._config?.performance?.features.card_loading_indicator !== false &&
      !this._controller.getMessageManager().hasMessage();

    // Caution: Keep the main div and the menu next to one another in order to
    // ensure the hover menu styling continues to work.
    return this._renderInDialogIfNecessary(
      html` <ha-card
        id="ha-card"
        .actionHandler=${actionHandler({
          hasHold: hasAction(actions.hold_action),
          hasDoubleClick: hasAction(actions.double_tap_action),
        })}
        style="${styleMap(this._controller.getStyleManager().getAspectRatioStyle())}"
        @advanced-camera-card:message=${(ev: CustomEvent<Message>) =>
          this._controller.getMessageManager().setMessageIfHigherPriority(ev.detail)}
        @advanced-camera-card:media:loaded=${(ev: CustomEvent<MediaLoadedInfo>) =>
          this._controller.getMediaLoadedInfoManager().set(ev.detail)}
        @advanced-camera-card:media:unloaded=${() =>
          this._controller.getMediaLoadedInfoManager().clear()}
        @advanced-camera-card:media:volumechange=${
          () => this.requestUpdate() /* Refresh mute menu button */
        }
        @advanced-camera-card:media:play=${
          () => this.requestUpdate() /* Refresh play/pause menu button */
        }
        @advanced-camera-card:media:pause=${
          () => this.requestUpdate() /* Refresh play/pause menu button */
        }
        @advanced-camera-card:focus=${() => this.focus()}
      >
        ${showLoading
          ? html`<advanced-camera-card-loading
              ?loaded=${this._controller.getInitializationManager().wasEverInitialized()}
            ></advanced-camera-card-loading>`
          : ''}
        ${this._renderMenuStatusContainer('top')}
        ${this._renderMenuStatusContainer('overlay')}
        <div ${ref(this._refMain)} class="${classMap(mainClasses)}">
          <advanced-camera-card-views
            ${ref(this._refViews)}
            .hass=${this._hass}
            .viewManagerEpoch=${this._controller.getViewManager().getEpoch()}
            .cameraManager=${cameraManager}
            .resolvedMediaCache=${this._controller.getResolvedMediaCache()}
            .config=${this._controller.getConfigManager().getConfig()}
            .cardWideConfig=${this._controller.getConfigManager().getCardWideConfig()}
            .rawConfig=${this._controller.getConfigManager().getRawConfig()}
            .configManager=${this._controller.getConfigManager()}
            .hide=${!!this._controller.getMessageManager().hasMessage()}
            .microphoneState=${this._controller.getMicrophoneManager().getState()}
            .triggeredCameraIDs=${this._config?.view.triggers.show_trigger_status
              ? this._controller.getTriggersManager().getTriggeredCameraIDs()
              : undefined}
            .deviceRegistryManager=${this._controller.getDeviceRegistryManager()}
          ></advanced-camera-card-views>
          ${this._controller.getMessageManager().hasMessage()
            ? // Keep message rendering to last to show messages that may have been
              // generated during the render.
              renderMessage(this._controller.getMessageManager().getMessage())
            : ''}
        </div>
        ${this._renderMenuStatusContainer('bottom')}
        ${this._config?.elements
          ? // Elements need to render after the main views so it can render 'on
            // top'.
            html` <advanced-camera-card-elements
              ${ref(this._refElements)}
              .hass=${this._hass}
              .elements=${this._config?.elements}
              @advanced-camera-card:menu:add=${(ev: CustomEvent<MenuItem>) => {
                this._menuButtonController.addDynamicMenuButton(ev.detail);
                this.requestUpdate();
              }}
              @advanced-camera-card:menu:remove=${(ev: CustomEvent<MenuItem>) => {
                this._menuButtonController.removeDynamicMenuButton(ev.detail);
                this.requestUpdate();
              }}
              @advanced-camera-card:status-bar:add=${(
                ev: CustomEvent<StatusBarItem>,
              ) => {
                this._controller
                  .getStatusBarItemManager()
                  .addDynamicStatusBarItem(ev.detail);
              }}
              @advanced-camera-card:status-bar:remove=${(
                ev: CustomEvent<StatusBarItem>,
              ) => {
                this._controller
                  .getStatusBarItemManager()
                  .removeDynamicStatusBarItem(ev.detail);
              }}
              @advanced-camera-card:condition-state-manager:get=${(
                ev: ConditionStateManagerGetEvent,
              ) => {
                ev.conditionStateManager = this._controller.getConditionStateManager();
              }}
            >
            </advanced-camera-card-elements>`
          : ``}
      </ha-card>`,
    );
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(cardStyle);
  }

  public getCardSize(): number {
    // This method is called before the card is rendered. As such, we don't
    // actually know what height the card will end up being, and for this card
    // it may change significantly with usage. As such, we just return a fixed
    // size guess (stock HA cards, such as the picture glance card, do similar).

    // Lovelace card size is expressed in units of 50px. A 16:9 aspect-ratio
    // camera will likely render as a 276.75px height masonary card => 5.52
    // units of 50, round up to 6.
    return 6;
  }
}

// Keep the old name around for backwards compatibility.
@customElement('frigate-card')
class FrigateCard extends AdvancedCameraCard {}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card': AdvancedCameraCard;
    'frigate-card': FrigateCard;
  }
}
