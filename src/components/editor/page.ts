import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { localize } from '../../localize/localize';
import editorPageStyle from '../../scss/editor-page.scss';
import { fireAdvancedCameraCardEvent } from '../../utils/fire-advanced-camera-card-event';

// The editor for one item of a list, shown in place of the list itself: a
// heading naming the item, a control to go back to the list, and the item's
// own content.
@customElement('advanced-camera-card-editor-page')
export class AdvancedCameraCardEditorPage extends LitElement {
  @property()
  public heading?: string;

  protected updated(changedProps: PropertyValues): void {
    // Opening an item replaces a list the user may have scrolled down into, so
    // the new page can begin above the viewport. Bring its top into view. The
    // heading changes on the first render and on each further drill-in, which
    // is exactly when a fresh page has been shown. The scroll waits a frame so
    // the replaced content has been laid out and the target position is final.
    if (changedProps.has('heading')) {
      requestAnimationFrame(() => this.scrollIntoView({ block: 'start' }));
    }
  }

  protected render(): TemplateResult {
    return html`
      <div class="header">
        <ha-icon-button-prev
          .label=${localize('editor.back')}
          @click=${() =>
            fireAdvancedCameraCardEvent(this, 'editor:page:back', undefined, {
              bubbles: true,
              composed: false,
            })}
        ></ha-icon-button-prev>
        <span class="heading">${this.heading}</span>
      </div>
      <slot></slot>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(editorPageStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-editor-page': AdvancedCameraCardEditorPage;
  }
}
