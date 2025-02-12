import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ConditionsManager } from '../conditions/conditions-manager.js';
import { getConditionStateManagerViaEvent } from '../conditions/state-manager-via-event.js';
import { dispatchAdvancedCameraCardErrorEvent } from '../components-lib/message/dispatch.js';
import {
  AdvancedCameraCardConditional,
  MenuIcon,
  MenuItem,
  MenuStateIcon,
  MenuSubmenu,
  MenuSubmenuSelect,
  PictureElements,
  StatusBarIcon,
  StatusBarImage,
  StatusBarItem,
  StatusBarString,
} from '../config/types.js';
import { localize } from '../localize/localize.js';
import elementsStyle from '../scss/elements.scss';
import { AdvancedCameraCardError } from '../types.js';
import { dispatchAdvancedCameraCardEvent, errorToConsole } from '../utils/basic.js';

/* A note on picture element rendering:
 *
 * To avoid needing to deal with the rendering of all the picture elements
 * ourselves, instead the card relies on a stock conditional element (with no
 * conditions) to render elements (this._root). This has a few advantages:
 *
 * - Does not depend on (much of!) an internal API -- conditional picture
 *   elements are unlikely to go away or change.
 * - Forces usage of elements that HA understands. If the rendering is done
 *   directly, it is (ask me how I know!) very tempting to render things in such
 *   a way that a nested conditional element would not be able to render, i.e.
 *   the custom rendering logic would only apply at the first level.
 */

/* A note on custom elements:
 *
 * The native HA support for custom elements is used for the menu-icon and
 * menu-state-icon elements. This ensures multi-nested conditionals will work
 * correctly. These custom elements 'render' by firing events that are caught by
 * the card to call for inclusion/exclusion of the menu icon in question.
 *
 * One major complexity here is that the top <advanced-camera-card-elements> element
 * will not necessarily know when a menu icon is no longer rendered because of a
 * conditional that no-longer evaluates to true. As such, it cannot know when to
 * signal for the menu icon removal. Furthermore, the menu icon element itself
 * will only know it's been removed _after_ it's been disconnected from the DOM,
 * so normal event propagation at that point will not work. Instead, we must
 * catch the menu icon _addition_ and register the eventhandler for the removal
 * directly on the child (which will have no parent at time of calling). That
 * then triggers <advanced-camera-card-elements> to re-dispatch a removal event for
 * upper layers to handle correctly.
 */

interface HuiConditionalElement extends HTMLElement {
  hass: HomeAssistant;
  setConfig(config: unknown): void;
}

// A small wrapper around a HA conditional element used to render a set of
// picture elements.
@customElement('advanced-camera-card-elements-core')
export class AdvancedCameraCardElementsCore extends LitElement {
  @property({ attribute: false })
  public elements?: PictureElements;

  protected _root: HuiConditionalElement | null = null;

  @property({ attribute: false })
  public hass?: HomeAssistant;

  /**
   * Create a transparent render root.
   */
  createRenderRoot(): LitElement {
    return this;
  }

  /**
   * Create the root node for our picture elements.
   * @returns The newly created root.
   */
  protected _createRoot(): HuiConditionalElement {
    const elementConstructor = customElements.get('hui-conditional-element');
    if (!elementConstructor || !this.hass) {
      throw new Error(localize('error.could_not_render_elements'));
    }

    const element = new elementConstructor() as HuiConditionalElement;
    element.hass = this.hass;
    const config = {
      type: 'conditional',
      conditions: [],
      elements: this.elements,
    };
    try {
      element.setConfig(config);
    } catch (e) {
      errorToConsole(e as Error, console.error);
      throw new AdvancedCameraCardError(localize('error.invalid_elements_config'));
    }
    return element;
  }

  /**
   * Create the root as necessary prior to rendering.
   */
  protected willUpdate(changedProps: PropertyValues): void {
    try {
      // The root is only created once per elements configuration change, to
      // avoid the elements being continually re-created & destroyed (for some
      // elements, e.g. image, recreation causes a flicker).
      if (this.elements && (!this._root || changedProps.has('elements'))) {
        this._root = this._createRoot();
      }
    } catch (e) {
      return dispatchAdvancedCameraCardErrorEvent(this, e as AdvancedCameraCardError);
    }
  }

  /**
   * Render the elements.
   * @returns A rendered template or void.
   */
  protected render(): TemplateResult | void {
    return html`${this._root || ''}`;
  }

  protected updated(): void {
    if (this.hass && this._root) {
      // Always update hass. It is used as a trigger to re-evaluate conditions
      // down the chain, see the note on AdvancedCameraCardElementsConditional.
      this._root.hass = this.hass;
    }
  }
}

/**
 * The master <advanced-camera-card-elements> class, handles event listeners and styles.
 */
@customElement('advanced-camera-card-elements')
export class AdvancedCameraCardElements extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public elements: PictureElements;

  protected _addHandler(
    target: EventTarget,
    eventName: string,
    handler: (ev: Event) => void,
  ) {
    // Ensure listener is only attached 1 time by removing it first.
    target.removeEventListener(eventName, handler);
    target.addEventListener(eventName, handler);
  }

  protected _menuRemoveHandler = (ev: Event): void => {
    // Re-dispatch event from this element (instead of the disconnected one, as
    // there is no parent of the disconnected element).
    dispatchAdvancedCameraCardEvent<MenuItem>(
      this,
      'menu:remove',
      (ev as CustomEvent).detail,
    );
  };

  protected _statusBarRemoveHandler = (ev: Event): void => {
    // Re-dispatch event from this element (instead of the disconnected one, as
    // there is no parent of the disconnected element).
    dispatchAdvancedCameraCardEvent<StatusBarItem>(
      this,
      'status-bar:remove',
      (ev as CustomEvent).detail,
    );
  };

  protected _menuAddHandler = (ev: Event): void => {
    ev = ev as CustomEvent<MenuItem>;
    const path = ev.composedPath();
    if (!path.length) {
      return;
    }
    this._addHandler(
      path[0],
      'advanced-camera-card:menu:remove',
      this._menuRemoveHandler,
    );
  };

  protected _statusBarAddHandler = (ev: Event): void => {
    ev = ev as CustomEvent<MenuItem>;
    const path = ev.composedPath();
    if (!path.length) {
      return;
    }
    this._addHandler(
      path[0],
      'advanced-camera-card:status-bar:add',
      this._statusBarRemoveHandler,
    );
  };

  connectedCallback(): void {
    super.connectedCallback();

    // Catch icons being added to the menu or status-bar (so their removal can
    // be subsequently handled).
    this.addEventListener('advanced-camera-card:menu:add', this._menuAddHandler);
    this.addEventListener(
      'advanced-camera-card:status-bar:add',
      this._statusBarAddHandler,
    );
  }

  disconnectedCallback(): void {
    this.removeEventListener('advanced-camera-card:menu:add', this._menuAddHandler);
    this.addEventListener(
      'advanced-camera-card:status-bar:add',
      this._statusBarAddHandler,
    );
    super.disconnectedCallback();
  }

  protected render(): TemplateResult {
    return html`<advanced-camera-card-elements-core
      .hass=${this.hass}
      .elements=${this.elements}
    >
    </advanced-camera-card-elements-core>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(elementsStyle);
  }
}

/**
 * An element that can render others based on card state (e.g. only show
 * overlays in particular views). This is the Advanced Camera Card equivalent to
 * the HA conditional card.
 */
@customElement('advanced-camera-card-conditional')
export class AdvancedCameraCardElementsConditional extends LitElement {
  protected _config?: AdvancedCameraCardConditional;
  protected _conditionManager: ConditionsManager | null = null;

  // A note on hass as an update mechanism:
  //
  // Every set of hass is treated as a reason to re-evaluate. Given that this
  // node may be buried down the DOM (as a descendent of non-Advanced Camera
  // Card elements), the hass object is used as the (only) trigger for condition
  // re-fetch even if hass itself has not changed.
  @property({ attribute: false, hasChanged: () => true })
  public hass?: HomeAssistant;

  /**
   * Set the card configuration.
   * @param config The card configuration.
   */
  public setConfig(config: AdvancedCameraCardConditional): void {
    this._config = config;
    this._createConditionManager();
  }

  /**
   * Create a root into which to render. This card is "transparent".
   * @returns
   */
  createRenderRoot(): LitElement {
    return this;
  }

  /**
   * Connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();

    // HA will automatically attach the 'element' class to picture elements. As
    // this is a transparent 'conditional' element (just like the stock HA
    // 'conditional' element), it should not have positioning.
    this.className = '';

    this._createConditionManager();
  }

  disconnectedCallback(): void {
    this._conditionManager?.destroy();
  }

  protected _createConditionManager(): void {
    const conditionStateManager = getConditionStateManagerViaEvent(this);
    if (!this._config || !conditionStateManager) {
      return;
    }
    this._conditionManager?.destroy();
    this._conditionManager = new ConditionsManager(
      this._config.conditions,
      conditionStateManager,
    );
    this._conditionManager.addListener(() => this.requestUpdate());
  }

  /**
   * Render the card.
   */
  protected render(): TemplateResult | void {
    if (this._conditionManager?.getEvaluation()?.result) {
      return html` <advanced-camera-card-elements-core
        .hass=${this.hass}
        .elements=${this._config?.elements}
      >
      </advanced-camera-card-elements-core>`;
    }
  }
}

// A base class for rendering menu icons / menu state icons.
export class AdvancedCameraCardElementsBaseItem<ConfigType> extends LitElement {
  protected _eventCategory: string;

  constructor(eventCategory: string) {
    super();
    this._eventCategory = eventCategory;
  }

  @state()
  protected _config: ConfigType | null = null;

  public setConfig(config: ConfigType): void {
    this._config = config;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this._config) {
      dispatchAdvancedCameraCardEvent<ConfigType>(
        this,
        `${this._eventCategory}:add`,
        this._config,
      );
    }
  }

  disconnectedCallback(): void {
    if (this._config) {
      dispatchAdvancedCameraCardEvent<ConfigType>(
        this,
        `${this._eventCategory}:remove`,
        this._config,
      );
    }
    super.disconnectedCallback();
  }
}

export class AdvancedCameraCardElementsBaseMenuItem<
  ConfigType,
> extends AdvancedCameraCardElementsBaseItem<ConfigType> {
  constructor() {
    super('menu');
  }
}

@customElement('advanced-camera-card-menu-icon')
export class AdvancedCameraCardElementsMenuIcon extends AdvancedCameraCardElementsBaseMenuItem<MenuIcon> {}

@customElement('advanced-camera-card-menu-state-icon')
export class AdvancedCameraCardElementsMenuStateIcon extends AdvancedCameraCardElementsBaseMenuItem<MenuStateIcon> {}

@customElement('advanced-camera-card-menu-submenu')
export class AdvancedCameraCardElementsMenuSubmenu extends AdvancedCameraCardElementsBaseMenuItem<MenuSubmenu> {}

@customElement('advanced-camera-card-menu-submenu-select')
export class AdvancedCameraCardElementsMenuSubmenuSelect extends AdvancedCameraCardElementsBaseMenuItem<MenuSubmenuSelect> {}

export class AdvancedCameraCardElementsBaseStatusBarItem<
  ConfigType,
> extends AdvancedCameraCardElementsBaseItem<ConfigType> {
  constructor() {
    super('status-bar');
  }
}

@customElement('advanced-camera-card-status-bar-icon')
export class AdvancedCameraCardElementsStatusBarIcon extends AdvancedCameraCardElementsBaseStatusBarItem<StatusBarIcon> {}

@customElement('advanced-camera-card-status-bar-image')
export class AdvancedCameraCardElementsStatusBarImage extends AdvancedCameraCardElementsBaseStatusBarItem<StatusBarImage> {}

@customElement('advanced-camera-card-status-bar-string')
export class AdvancedCameraCardElementsStatusBarString extends AdvancedCameraCardElementsBaseStatusBarItem<StatusBarString> {}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-conditional': AdvancedCameraCardElementsConditional;
    'advanced-camera-card-elements': AdvancedCameraCardElements;
    'advanced-camera-card-elements-core': AdvancedCameraCardElementsCore;

    'advanced-camera-card-menu-icon': AdvancedCameraCardElementsMenuIcon;
    'advanced-camera-card-menu-state-icon': AdvancedCameraCardElementsMenuStateIcon;
    'advanced-camera-card-menu-submenu': AdvancedCameraCardElementsMenuSubmenu;
    'advanced-camera-card-menu-submenu-select': AdvancedCameraCardElementsMenuSubmenuSelect;

    'advanced-camera-card-status-bar-icon': AdvancedCameraCardElementsStatusBarIcon;
    'advanced-camera-card-status-bar-image': AdvancedCameraCardElementsStatusBarImage;
    'advanced-camera-card-status-bar-string': AdvancedCameraCardElementsStatusBarString;
  }
}
