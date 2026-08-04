import {
  html,
  LitElement,
  nothing,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { localize } from '../../localize/localize';
import editorListStyle from '../../scss/editor-list.scss?inline';
import { fireAdvancedCameraCardEvent } from '../../utils/fire-advanced-camera-card-event';

import './../icon';

// One item of the list: what to call it, and a line below that naming what it
// refers to where the title alone does not say.
export interface EditorListItem {
  title: string;
  description?: string;
}

// A list of configuration items, rendered as the rows Home Assistant uses for
// the editable lists in its own editors. An item is opened with the row's edit
// control, which reports `item-edit` for the owner to show that item's editor
// in place of the list. Reordering is done by dragging a row's handle.
//
// The events do not bubble beyond the owner: they are composed only as far as
// the list's own host, since the editor above interprets nothing between here
// and itself.
@customElement('advanced-camera-card-editor-list')
export class AdvancedCameraCardEditorList extends LitElement {
  // The items, in list order. Their configuration is not passed: the owner
  // renders each item's editor when asked.
  @property({ attribute: false })
  public items: EditorListItem[] = [];

  @property()
  public itemIcon?: string;

  @property()
  public addLabel?: string;

  protected render(): TemplateResult {
    return html`
      <ha-sortable
        handle-selector=".handle"
        draggable-selector=".item"
        @item-moved=${(ev: CustomEvent<{ oldIndex: number; newIndex: number }>) => {
          ev.stopPropagation();
          this._fire('item-move', { from: ev.detail.oldIndex, to: ev.detail.newIndex });
        }}
      >
        <ha-md-list>
          ${this.items.map((item, index) => this._renderItem(item, index))}
        </ha-md-list>
      </ha-sortable>
      ${this._renderAdd()}
    `;
  }

  private _renderItem(item: EditorListItem, index: number): TemplateResult {
    return html`
      <ha-md-list-item class="item">
        <advanced-camera-card-icon
          slot="start"
          class="handle"
          .icon=${{ icon: 'mdi:drag-horizontal-variant' }}
        ></advanced-camera-card-icon>
        <advanced-camera-card-icon
          slot="start"
          .icon=${{ icon: this.itemIcon }}
        ></advanced-camera-card-icon>
        <div slot="headline" class="title">${item.title}</div>
        ${item.description
          ? html`<div slot="supporting-text" class="description">
              ${item.description}
            </div>`
          : nothing}
        ${this._renderControl('mdi:pencil', localize('editor.edit'), () =>
          this._fire('item-edit', { index }),
        )}
        ${this._renderControl('mdi:delete', localize('editor.delete'), () =>
          this._fire('item-delete', { index }),
        )}
      </ha-md-list-item>
    `;
  }

  private _renderAdd(): TemplateResult {
    return html`
      <ha-button
        class="add"
        appearance="filled"
        size="s"
        @click=${() => this._fire('item-add', {})}
      >
        <advanced-camera-card-icon
          slot="start"
          .icon=${{ icon: 'mdi:plus' }}
        ></advanced-camera-card-icon>
        ${this.addLabel}
      </ha-button>
    `;
  }

  private _renderControl(
    icon: string,
    label: string,
    action: () => void,
  ): TemplateResult {
    return html`
      <ha-icon-button slot="end" .label=${label} title=${label} @click=${action}>
        <advanced-camera-card-icon .icon=${{ icon }}></advanced-camera-card-icon>
      </ha-icon-button>
    `;
  }

  private _fire(name: string, detail: Record<string, number>): void {
    fireAdvancedCameraCardEvent(this, `editor:list:${name}`, detail, {
      bubbles: true,
      composed: false,
    });
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(editorListStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-editor-list': AdvancedCameraCardEditorList;
  }
}
