import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import './components/editor/cameras.js';
import './components/editor/doc-link.js';
import './components/editor/folders.js';
import './components/editor/keyboard-shortcuts.js';
import './components/editor/section.js';
import './components/icon.js';

import { EditorController } from './components-lib/editor/controller.js';
import type { FormsInput } from './components-lib/editor/forms-controller.js';
import type { EditorIntent } from './components-lib/editor/intents.js';
import type { FormRequest } from './components-lib/editor/schema/registry.js';
import type { RawAdvancedCameraCardConfig } from './config/types.js';
import type { HAFormSchema, HomeAssistant, LovelaceCardEditor } from './ha/types.js';
import { localize } from './localize/localize.js';
import editorStyle from './scss/editor.scss';
import { fireAdvancedCameraCardEvent } from './utils/fire-advanced-camera-card-event.js';

interface EditorSection {
  icon: string;
  name: string;
  description: string;

  // The part of the section a schema cannot express: a list the user adds to
  // and reorders, or a key assigned by pressing it. A section whose whole
  // configuration is such a list has no schema forms, and shows only this
  // content.
  renderCustomContent?: (hass: HomeAssistant, input: FormsInput) => TemplateResult;
}

// Ordered as rendered: cameras first, then alphabetical by displayed name.
const SECTIONS: Record<string, EditorSection> = {
  cameras: {
    icon: 'video',
    name: localize('editor.cameras'),
    description: localize('editor.cameras_secondary'),
    renderCustomContent: (hass, input) => html`
      <advanced-camera-card-editor-cameras
        .hass=${hass}
        .input=${input}
      ></advanced-camera-card-editor-cameras>
    `,
  },
  dimensions: {
    icon: 'aspect-ratio',
    name: localize('editor.dimensions'),
    description: localize('editor.dimensions_secondary'),
  },
  folders: {
    icon: 'folder-multiple',
    name: localize('editor.folders'),
    description: localize('editor.folders_secondary'),
    renderCustomContent: (hass, input) => html`
      <advanced-camera-card-editor-folders
        .hass=${hass}
        .input=${input}
      ></advanced-camera-card-editor-folders>
    `,
  },
  image: {
    icon: 'image',
    name: localize('editor.image'),
    description: localize('editor.image_secondary'),
  },
  live: {
    icon: 'cctv',
    name: localize('editor.live'),
    description: localize('editor.live_secondary'),
  },
  media_gallery: {
    icon: 'play-box-multiple',
    name: localize('editor.media_gallery'),
    description: localize('editor.media_gallery_secondary'),
  },
  media_viewer: {
    icon: 'filmstrip',
    name: localize('editor.media_viewer'),
    description: localize('editor.media_viewer_secondary'),
  },
  menu: {
    icon: 'menu',
    name: localize('editor.menu'),
    description: localize('editor.menu_secondary'),
  },
  performance: {
    icon: 'speedometer',
    name: localize('editor.performance'),
    description: localize('editor.performance_secondary'),
  },
  profiles: {
    icon: 'folder-wrench-outline',
    name: localize('editor.profiles'),
    description: localize('editor.profiles_secondary'),
  },
  remote_control: {
    icon: 'remote',
    name: localize('editor.remote_control'),
    description: localize('editor.remote_control_secondary'),
  },
  status_bar: {
    icon: 'sign-text',
    name: localize('editor.status_bar'),
    description: localize('editor.status_bar_secondary'),
  },
  timeline: {
    icon: 'chart-gantt',
    name: localize('editor.timeline'),
    description: localize('editor.timeline_secondary'),
  },
  view: {
    icon: 'eye',
    name: localize('editor.view'),
    description: localize('editor.view_secondary'),

    // The keyboard shortcuts are a panel of their own within the view section:
    // a shortcut is assigned by pressing a key rather than by filling in a
    // field, so no selector can express one.
    renderCustomContent: (hass, input) => html`
      <advanced-camera-card-editor-keyboard-shortcuts
        .hass=${hass}
        .input=${input}
      ></advanced-camera-card-editor-keyboard-shortcuts>
    `,
  },
};

/**
 * Used to side-load lazily-loaded selectors the editor will use.
 * See {@link AdvancedCameraCardEditor._renderSelectorSideload}.
 */
const SELECTOR_SIDELOAD_SCHEMA: HAFormSchema[] = [
  { name: 'text', selector: { text: {} } },
  { name: 'select', selector: { select: { options: [] } } },
  { name: 'number', selector: { number: {} } },
  { name: 'boolean', selector: { boolean: {} } },
  { name: 'icon', selector: { icon: {} } },
  { name: 'entity', selector: { entity: {} } },
  { name: 'object', selector: { object: {} } },
  { name: 'sideload', type: 'expandable', title: '', schema: [] },
];
const SELECTOR_SIDELOAD_DATA = {};

@customElement('advanced-camera-card-editor')
export class AdvancedCameraCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  private _controller = new EditorController(this);

  public setConfig(config: RawAdvancedCameraCardConfig): void {
    this._controller.setConfig(config);
  }

  protected willUpdate(changedProps: PropertyValues): void {
    this._controller.initialize();

    if (changedProps.has('hass') && this.hass) {
      this._controller.setHASS(this.hass);
    }
  }

  protected render(): TemplateResult | void {
    const hass = this.hass;
    if (!hass || !this._controller.getConfig()) {
      return html``;
    }

    // Built once and given to every section: the sections compare what they are
    // given against what they last had, and an identical object makes that
    // comparison a reference check.
    const input = this._controller.getFormsInput();

    return html`
      ${this._renderSelectorSideload()}
      <div
        class="card-config"
        @advanced-camera-card:editor:intent=${(ev: CustomEvent<EditorIntent>) =>
          this._controller.applyIntent(ev.detail)}
      >
        ${this._renderNotices()}
        ${Object.keys(SECTIONS).map((name) => this._renderSection(name, hass, input))}
        ${this._renderActionButtons()}
      </div>
    `;
  }

  private _renderSection(
    name: string,
    hass: HomeAssistant,
    input: FormsInput,
  ): TemplateResult {
    const section = SECTIONS[name];
    const request: FormRequest = { kind: 'section', name };
    const renderCustomContent = section.renderCustomContent;

    return html`
      <advanced-camera-card-editor-section
        class="section"
        .hass=${hass}
        .request=${request}
        .input=${input}
        .icon=${`mdi:${section.icon}`}
        .heading=${section.name}
        .description=${section.description}
        .documentationPath=${[name]}
        .renderCustomContent=${renderCustomContent
          ? () => renderCustomContent(hass, input)
          : undefined}
      ></advanced-camera-card-editor-section>
    `;
  }

  // Card-state notices rendered as banners above the sections (matching how
  // native Home Assistant editors surface such notes).
  private _renderNotices(): TemplateResult {
    return html`${this._controller
      .getNotices()
      .map(
        (notice) =>
          html`<ha-alert alert-type=${notice.type}>${notice.message}</ha-alert>`,
      )}`;
  }

  private _renderActionButtons(): TemplateResult {
    return html`
      <div class="action-buttons">
        ${this._controller.isConfigUpgradeable()
          ? html`<ha-button
              appearance="filled"
              variant="warning"
              title=${localize('editor.upgrade_available')}
              aria-label=${localize('editor.upgrade_available')}
              @click=${() => this._controller.upgrade()}
            >
              ${localize('editor.upgrade')}
            </ha-button>`
          : ''}
        <ha-button
          title=${localize('editor.toggle_diagnostics')}
          aria-label=${localize('editor.toggle_diagnostics')}
          @click=${() => {
            fireAdvancedCameraCardEvent(this, 'editor:diagnostics');
          }}
        >
          ${localize('editor.toggle_diagnostics')}
        </ha-button>
      </div>
    `;
  }

  // `ha-form` and `ha-selector` lazily `import()` their per-type sub-elements
  // on first use. A section rendered before those imports resolve is not laid
  // out in time for its `ha-expansion-panel` to measure the correct height, so
  // a hidden form covering every element type the editor uses is rendered up
  // front to resolve the imports before the user opens anything.
  private _renderSelectorSideload(): TemplateResult {
    return html`
      <ha-form
        class="selector-sideload"
        .hass=${this.hass}
        .schema=${SELECTOR_SIDELOAD_SCHEMA}
        .data=${SELECTOR_SIDELOAD_DATA}
      ></ha-form>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(editorStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-editor': AdvancedCameraCardEditor;
  }
}
