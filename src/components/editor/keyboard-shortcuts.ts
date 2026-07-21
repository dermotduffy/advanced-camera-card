import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { getLocalizationKeyForPath } from '../../components-lib/editor/form-labels.js';
import type { FormsInput } from '../../components-lib/editor/forms-controller.js';
import { KeyboardShortcutsController } from '../../components-lib/editor/keyboard-shortcuts-controller.js';
import { CONF_VIEW_KEYBOARD_SHORTCUTS } from '../../config/const.js';
import type { KeyboardShortcut } from '../../config/schema/view.js';
import type { HomeAssistant } from '../../ha/types.js';
import { localize } from '../../localize/localize.js';
import editorKeyboardShortcutsStyle from '../../scss/editor-keyboard-shortcuts.scss';
import { renderDocumentation } from './doc-link.js';
import { renderForms } from './form.js';

import './../icon';
import './../key-assigner';

// The keyboard shortcuts panel. Hand-built rather than an `ha-form` expandable
// because a shortcut is assigned by pressing a key, which no selector can
// express.
@customElement('advanced-camera-card-editor-keyboard-shortcuts')
export class AdvancedCameraCardEditorKeyboardShortcuts extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public input?: FormsInput;

  private _controller = new KeyboardShortcutsController(this, (path) =>
    renderDocumentation(path),
  );

  protected willUpdate(): void {
    if (this.input) {
      this._controller.setInput(this.input);
    }
  }

  protected render(): TemplateResult {
    return html`
      <ha-expansion-panel outlined>
        <advanced-camera-card-icon
          slot="leading-icon"
          .icon=${{ icon: 'mdi:keyboard' }}
        ></advanced-camera-card-icon>
        <span slot="header"
          >${localize('config.view.keyboard_shortcuts.editor_label')}</span
        >
        <div class="values" @transitionend=${(ev: Event) => ev.stopPropagation()}>
          ${renderDocumentation(CONF_VIEW_KEYBOARD_SHORTCUTS.split('.'))}
          ${renderForms(this.hass, this._controller.getContexts())}
          ${Object.keys(this._controller.getShortcuts()).map((name) =>
            this._renderKeyAssigner(name),
          )}
        </div>
      </ha-expansion-panel>
    `;
  }

  private _renderKeyAssigner(name: string): TemplateResult {
    return html`<advanced-camera-card-key-assigner
      .label=${localize(
        getLocalizationKeyForPath([...CONF_VIEW_KEYBOARD_SHORTCUTS.split('.'), name]),
      )}
      .value=${this._controller.getShortcuts()[name]}
      @value-changed=${(ev: CustomEvent<{ value: KeyboardShortcut | null }>) =>
        this._controller.setShortcut(name, ev.detail.value)}
    ></advanced-camera-card-key-assigner>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(editorKeyboardShortcutsStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-editor-keyboard-shortcuts': AdvancedCameraCardEditorKeyboardShortcuts;
  }
}
