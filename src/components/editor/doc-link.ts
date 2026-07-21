import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { getDocURL } from '../../components-lib/editor/doc-links';
import { localize } from '../../localize/localize';
import editorDocLinkStyle from '../../scss/editor-doc-link.scss';

// A self-styled documentation link row. Carries its own styles so it renders
// correctly when passed into the shadow DOM of Home Assistant elements (e.g. as
// an `ha-form` expandable description), where the editor's stylesheet cannot
// reach.
@customElement('advanced-camera-card-editor-doc-link')
export class AdvancedCameraCardEditorDocLink extends LitElement {
  @property({ attribute: false })
  public url?: string;

  protected render(): TemplateResult | void {
    if (!this.url) {
      return;
    }
    return html`
      <a
        href=${this.url}
        target="_blank"
        rel="noopener noreferrer"
        title=${localize('editor.docs')}
      >
        <ha-icon icon="mdi:book-open-page-variant"></ha-icon>
        <div>${localize('editor.docs')}</div>
        <ha-icon icon="mdi:open-in-new"></ha-icon>
      </a>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(editorDocLinkStyle);
  }
}

/**
 * Render the documentation link for a configuration path.
 * @param path The configuration path.
 * @returns A rendered template, or null when the path has no documentation.
 */
export const renderDocumentation = (
  path: (string | number)[],
): TemplateResult | null => {
  const url = getDocURL(path);
  return url
    ? html`<advanced-camera-card-editor-doc-link
        .url=${url}
      ></advanced-camera-card-editor-doc-link>`
    : null;
};

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-editor-doc-link': AdvancedCameraCardEditorDocLink;
  }
}
