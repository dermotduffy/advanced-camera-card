import {
  html,
  LitElement,
  nothing,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type {
  FormContext,
  FormsInput,
} from '../../components-lib/editor/forms-controller';
import type { FormRequest } from '../../components-lib/editor/schema/registry';
import { SectionController } from '../../components-lib/editor/section-controller';
import type { HomeAssistant } from '../../ha/types';
import editorSectionStyle from '../../scss/editor-section.scss';
import { renderDocumentation } from './doc-link';
import { renderForms } from './form';

import './../icon';

// One top-level section of the editor: a panel that shows the forms of its part
// of the configuration, and optionally extra custom content.
@customElement('advanced-camera-card-editor-section')
export class AdvancedCameraCardEditorSection extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public request?: FormRequest;

  @property({ attribute: false })
  public input?: FormsInput;

  @property()
  public icon?: string;

  @property()
  public heading?: string;

  // The line shown under the heading, describing what the section covers.
  @property()
  public description?: string;

  // The path whose documentation the section links to; the section's own forms
  // supply the links for everything within them.
  @property({ attribute: false })
  public documentationPath?: (string | number)[];

  // Content shown after the section's schema forms, of which there may be
  // none. Called only once the section has been opened, and in the render that
  // opens it, so that the panel measures a height that includes it.
  @property({ attribute: false })
  public renderCustomContent?: () => TemplateResult;

  private _controller = new SectionController(this, (path) => renderDocumentation(path));

  protected willUpdate(): void {
    if (this.request && this.input) {
      this._controller.setInput(this.request, this.input);
    }
  }

  protected render(): TemplateResult {
    return html`
      <ha-expansion-panel
        .outlined=${this._controller.isOpen()}
        .header=${this.heading}
        .secondary=${this.description}
        @expanded-will-change=${(ev: CustomEvent<{ expanded: boolean }>) => {
          // Panels nested in the body emit the same event, and it crosses
          // shadow boundaries; only this panel's own toggles count.
          if (ev.target === ev.currentTarget) {
            this._controller.setOpen(ev.detail.expanded);
          }
        }}
      >
        <advanced-camera-card-icon
          slot="leading-icon"
          .icon=${{ icon: this.icon }}
        ></advanced-camera-card-icon>
        ${this._controller.wasEverOpened() ? this._renderBody() : nothing}
      </ha-expansion-panel>
    `;
  }

  private _renderBody(): TemplateResult {
    // Nested panels' expansion and transition events would otherwise reach the
    // panel above and disturb the height it animates to, or collapse it.
    return html`
      <div
        class="values"
        @transitionend=${this._stopPropagation}
        @expanded-will-change=${this._stopPropagation}
        @expanded-changed=${this._stopPropagation}
      >
        ${this.documentationPath ? renderDocumentation(this.documentationPath) : nothing}
        ${renderForms(this.hass, this._controller.getContexts())}
        ${this.renderCustomContent?.() ?? nothing}
      </div>
    `;
  }

  private _stopPropagation(ev: Event): void {
    ev.stopPropagation();
  }

  public getContexts(): FormContext[] {
    return this._controller.getContexts();
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(editorSectionStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-editor-section': AdvancedCameraCardEditorSection;
  }
}
