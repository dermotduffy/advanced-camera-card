import { css, html, LitElement, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

import { SIDE_LOADED_ELEMENTS } from '../../src/ha/side-load-ha-elements';

/**
 * The base the three `src/patches` classes subclass at runtime. Home
 * Assistant's real players own a `<video>` and a transport; this carries only
 * the members the patches touch, so the subclasses can be defined and
 * constructed. It plays nothing.
 */
class HAPlayerStandIn extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  public entityid?: string;
  public posterUrl?: string;
  public autoPlay = false;
  public muted = true;
  public playsInline = true;
  public controls = false;

  protected _error?: string;
  protected _errorIsFatal = false;

  protected _loadedData(): void {
    // The patches call through to this on the <video>'s `loadeddata`.
  }

  protected async _startWebRtc(): Promise<void> {
    // WebRTC negotiation, which this stand-in does not perform.
  }

  protected _cleanUp(): void {
    // Transport teardown, which this stand-in has none of.
  }
}

/**
 * A stand-in that renders its children and nothing else. Behavior is added only
 * for elements the card is observed to depend on.
 */
class HAElementStub extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  protected render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

/**
 * The surface a card is drawn on. Home Assistant's own `:host` styles to ensure
 * the card has background, border and corners for screenshots.
 */
class HACardStub extends HAElementStub {
  static styles = css`
    :host {
      background: var(--ha-card-background, var(--card-background-color, white));
      box-shadow: var(--ha-card-box-shadow, none);
      box-sizing: border-box;
      border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg));
      border-width: var(--ha-card-border-width, 1px);
      border-style: solid;
      border-color: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
      color: var(--primary-text-color);
      display: block;
      position: relative;
    }
  `;
}

/**
 * A round tap target sized by `--ha-icon-button-size`, which is how Home
 * Assistant's own icon button sizes itself and what the card sets to lay its
 * menu out. Without it a button is only as big as whatever it contains.
 *
 * Home Assistant draws a real `<button>` within, so a menu button takes focus
 * when it is pressed, can be tabbed to, and ignores a press while disabled.
 */
class HAIconButtonStub extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--ha-icon-button-size, 48px);
      height: var(--ha-icon-button-size, 48px);
      border-radius: 50%;
      box-sizing: border-box;
      outline: none;
    }
    button {
      align-items: center;
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      display: flex;
      height: 100%;
      justify-content: center;
      padding: 0;
      width: 100%;
    }
  `;

  @property({ type: Boolean })
  public disabled = false;

  protected render(): TemplateResult {
    return html`<button ?disabled=${this.disabled}><slot></slot></button>`;
  }
}

/**
 * Home Assistant fetches `mdi:` icons from Home Assistant, so there is nothing
 * to draw here. It still occupies an icon's space, so that the layout around it
 * is the layout a user would see.
 */
class HAIconStub extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      width: var(--mdc-icon-size, 24px);
      height: var(--mdc-icon-size, 24px);
    }
  `;
}

interface PictureElementConfig {
  type: string;
}

interface ConditionalElementConfig {
  elements?: PictureElementConfig[];
}

// Every Home Assistant element takes its own shape of configuration through the
// same call, and nothing here reads what is passed.
interface ConfigurableElement extends HTMLElement {
  setConfig(config: unknown): void;
}

const isConfigurable = (element: HTMLElement): element is ConfigurableElement =>
  'setConfig' in element;

const CUSTOM_ELEMENT_PREFIX = 'custom:';
const CARD_ELEMENT_PREFIX = `${CUSTOM_ELEMENT_PREFIX}advanced-camera-card-`;

// The element types Home Assistant marks as not listening for taps themselves.
const ACTION_DELEGATING_TYPES = ['icon', 'state-badge', 'state-icon', 'state-label'];

/**
 * Create one of Home Assistant's own picture elements, which it names after the
 * configured type and marks with the class it positions elements by.
 */
const createHAElement = (type: string): HTMLElement => {
  const element = Object.assign(document.createElement(`hui-${type}-element`), {
    delegatedActions: ACTION_DELEGATING_TYPES.includes(type),
    requestUpdate: () => {},
  });
  element.classList.add('element');
  return element;
};

/**
 * Home Assistant's conditional picture element, which the card builds one of on
 * every mount to host whatever picture elements are configured.
 *
 * Home Assistant creates one element per entry. The card's own menu and status
 * bar items are elements that ask to be added when they are connected, so
 * without that a configured menu button never reaches the menu.
 *
 * Home Assistant's own elements are created as empty stand-ins: they carry what
 * Home Assistant puts on them, but render nothing.
 */
class HuiConditionalElementStub extends HTMLElement {
  public hass?: unknown;

  public setConfig(config: ConditionalElementConfig): void {
    this.replaceChildren();

    for (const element of config.elements ?? []) {
      const child = element.type.startsWith(CARD_ELEMENT_PREFIX)
        ? document.createElement(
            // Example: custom:advanced-camera-card-menu-icon -> advanced-camera-card-menu-icon
            element.type.slice(CUSTOM_ELEMENT_PREFIX.length),
          )
        : createHAElement(element.type);

      if (isConfigurable(child)) {
        child.setConfig(element);
      }
      this.append(child);
    }
  }
}

// A fresh anonymous subclass every call: `customElements.define` rejects a
// constructor that is already registered under another name.
const createStub = (element: string): CustomElementConstructor => {
  switch (element) {
    case 'ha-camera-stream':
    case 'ha-hls-player':
    case 'ha-web-rtc-player':
      return class extends HAPlayerStandIn {};

    case 'ha-card':
      return class extends HACardStub {};

    case 'ha-icon-button':
    case 'ha-icon-button-prev':
      return class extends HAIconButtonStub {};

    case 'ha-icon':
    case 'ha-state-icon':
    case 'state-badge':
      return class extends HAIconStub {};

    case 'hui-conditional-element':
      return class extends HuiConditionalElementStub {};

    default:
      return class extends HAElementStub {};
  }
};

const defineElement = (name: string, constructor: CustomElementConstructor): void => {
  if (!customElements.get(name)) {
    customElements.define(name, constructor);
  }
};

/**
 * Define every Home Assistant element the card expects to already exist, so
 * that sideLoadHomeAssistantElements() returns at its first check and never
 * reaches its `picture-glance` side-load trick.
 */
export const defineHAElementStubs = (): void => {
  for (const element of SIDE_LOADED_ELEMENTS) {
    defineElement(element, createStub(element));
  }
};
