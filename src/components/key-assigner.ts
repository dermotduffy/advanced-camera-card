import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { KeyAssignerController } from '../components-lib/key-assigner-controller';
import { KeyboardShortcut } from '../config/schema/view';
import { localize } from '../localize/localize';
import keyAssignerStyle from '../scss/key-assigner.scss';
import './icon';

@customElement('advanced-camera-card-key-assigner')
export class AdvancedCameraCardKeyAssigner extends LitElement {
  @property({ attribute: false })
  public label?: string;

  @property({ attribute: false })
  public value?: KeyboardShortcut | null;

  protected _controller = new KeyAssignerController(this);

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('value')) {
      this._controller.setValue(this.value ?? null);
    }
  }

  protected render(): TemplateResult | void {
    if (!this.label) {
      return;
    }

    const renderKey = (key: string) => {
      return html`<div class="key">
        <div class="key-inner">${key}</div>
      </div>`;
    };

    return html`
      <div class="label">${this.label}</div>
      <ha-button
        class="assign"
        @click=${() => {
          this._controller.toggleAssigning();
        }}
      >
        <advanced-camera-card-icon .icon=${{ icon: 'mdi:keyboard-settings' }}></advanced-camera-card-icon>
        <span class="${classMap({
          dotdotdot: this._controller.isAssigning(),
        })}">
          ${this._controller.isAssigning() ? '' : localize('key_assigner.assign')}
        </span>
      </ha-button>
      ${
        this._controller.hasValue()
          ? html`<ha-button
              @click=${() => {
                this._controller.setValue(null);
              }}
            >
              <advanced-camera-card-icon
                .icon=${{ icon: 'mdi:keyboard-off' }}
              ></advanced-camera-card-icon>
              <span> ${localize('key_assigner.unassign')} </span>
            </ha-button>`
          : ''
      }
      <div class="key-row">
        ${this.value?.ctrl ? renderKey(localize('key_assigner.modifiers.ctrl')) : ''}
        ${this.value?.shift ? renderKey(localize('key_assigner.modifiers.shift')) : ''}
        ${this.value?.meta ? renderKey(localize('key_assigner.modifiers.meta')) : ''}
        ${this.value?.alt ? renderKey(localize('key_assigner.modifiers.alt')) : ''}
        ${this.value?.key ? renderKey(this.value.key) : ''}
      </div>
      </span>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(keyAssignerStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-key-assigner': AdvancedCameraCardKeyAssigner;
  }
}
