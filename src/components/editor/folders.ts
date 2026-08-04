import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { FormsInput } from '../../components-lib/editor/forms-controller';
import { ListFormsController } from '../../components-lib/editor/list-forms-controller';
import { ListPagesController } from '../../components-lib/editor/list-pages-controller';
import { getEditorFolderTitle } from '../../components-lib/editor/titles';
import type { ConfigPath } from '../../components-lib/editor/types';
import { CONF_FOLDERS } from '../../config/const';
import type { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import editorExpanderBodyStyle from '../../scss/editor-expander-body.scss?inline';
import { renderDocumentation } from './doc-link';
import { renderForms } from './form';

import './../icon';
import './list';
import './page';

const FOLDERS_PATH: ConfigPath = [CONF_FOLDERS];

// The single list this section drills into.
const FOLDERS_LIST = 'folders';

// The folders section's content: the list of folders, each with its own form.
@customElement('advanced-camera-card-editor-folders')
export class AdvancedCameraCardEditorFolders extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public input?: FormsInput;

  private _pages = new ListPagesController(this);

  private _controller = new ListFormsController(this, (path) =>
    renderDocumentation(path),
  );

  protected willUpdate(): void {
    if (this.input) {
      this._controller.setInput(this.input);
    }
  }

  protected render(): TemplateResult {
    const folders = this._controller.getList(FOLDERS_PATH);
    const [folder] = this._pages.getPath();

    // A page naming a folder that no longer exists (the configuration was
    // edited elsewhere) shows the list instead.
    if (folder !== undefined && folder.index < folders.length) {
      const index = folder.index;
      return html`
        <advanced-camera-card-editor-page
          .heading=${getEditorFolderTitle(index, folders[index])}
          @advanced-camera-card:editor:page:back=${() => this._pages.back()}
        >
          ${renderForms(
            this.hass,
            this._controller.getFormContexts({ kind: 'full-folder', index }),
          )}
          <ha-alert alert-type="info">
            ${localize('config.folders.ha.path_info')}
          </ha-alert>
        </advanced-camera-card-editor-page>
      `;
    }

    return html`
      <advanced-camera-card-editor-list
        itemIcon="mdi:folder"
        .addLabel=${localize('editor.add_new_folder')}
        .items=${folders.map((folder, folderIndex) => ({
          title: getEditorFolderTitle(folderIndex, folder),
        }))}
        @advanced-camera-card:editor:list:item-edit=${(
          ev: CustomEvent<{ index: number }>,
        ) => this._pages.open(FOLDERS_LIST, ev.detail.index)}
        @advanced-camera-card:editor:list:item-add=${() => {
          this._controller.addItem(FOLDERS_PATH, {});
          this._pages.open(FOLDERS_LIST, folders.length);
        }}
        @advanced-camera-card:editor:list:item-move=${(
          ev: CustomEvent<{ from: number; to: number }>,
        ) => this._controller.moveItem(FOLDERS_PATH, ev.detail.from, ev.detail.to)}
        @advanced-camera-card:editor:list:item-delete=${(
          ev: CustomEvent<{ index: number }>,
        ) => this._controller.deleteItem(FOLDERS_PATH, ev.detail.index)}
      ></advanced-camera-card-editor-list>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(editorExpanderBodyStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-editor-folders': AdvancedCameraCardEditorFolders;
  }
}
