import {
  html,
  LitElement,
  nothing,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { FormsInput } from '../../components-lib/editor/forms-controller';
import { ListFormsController } from '../../components-lib/editor/list-forms-controller';
import { ListPagesController } from '../../components-lib/editor/list-pages-controller';
import {
  getEditorCameraTitle,
  getEditorTriggerEventTitle,
} from '../../components-lib/editor/titles';
import type { ConfigPath } from '../../components-lib/editor/types';
import { CONF_CAMERAS } from '../../config/const';
import type { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import editorExpanderBodyStyle from '../../scss/editor-expander-body.scss';
import { renderDocumentation } from './doc-link';
import { renderForms } from './form';

import './../icon';
import './list';
import './page';

const CAMERAS_PATH: ConfigPath = [CONF_CAMERAS];

// The lists the user can drill into, named so a page holding more than one can
// tell which was entered.
const CAMERAS_LIST = 'cameras';
const EVENTS_LIST = 'events';

// The cameras section's content: the list of cameras, and the editor for
// whichever camera (or trigger event within it) the user opened. One level is
// shown at a time, as Home Assistant's own editors do for the items of a list.
@customElement('advanced-camera-card-editor-cameras')
export class AdvancedCameraCardEditorCameras extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public input?: FormsInput;

  private _pagesController = new ListPagesController(this);
  private _formsController = new ListFormsController(this, (path) =>
    renderDocumentation(path),
  );

  protected willUpdate(): void {
    if (this.input) {
      this._formsController.setInput(this.input);
    }
  }

  protected render(): TemplateResult {
    const cameras = this._formsController.getList(CAMERAS_PATH);
    const [camera, subpage] = this._pagesController.getPath();

    // A page naming a camera that no longer exists (the configuration was
    // edited elsewhere) shows the list instead.
    if (camera === undefined || camera.index >= cameras.length) {
      return this._renderList(cameras);
    }
    // A step below the camera names the sub-list it entered; today the only one
    // is the events. The camera page stays mounted (hidden) while an event is
    // edited, so its expanded panels are still expanded when the user comes
    // back to it, rather than being rebuilt collapsed.
    const event = subpage?.list === EVENTS_LIST ? subpage.index : null;
    return html`
      ${this._renderCamera(camera.index, event !== null)}
      ${event !== null ? this._renderEvent(camera.index, event) : nothing}
    `;
  }

  private _renderList(cameras: readonly unknown[]): TemplateResult {
    return html`
      <advanced-camera-card-editor-list
        itemIcon="mdi:video"
        .addLabel=${localize('editor.add_new_camera')}
        .items=${cameras.map((camera, index) => ({
          title: getEditorCameraTitle(index, camera, this.hass),
        }))}
        @advanced-camera-card:editor:list:item-edit=${(
          ev: CustomEvent<{ index: number }>,
        ) => this._pagesController.open(CAMERAS_LIST, ev.detail.index)}
        @advanced-camera-card:editor:list:item-add=${() => {
          this._formsController.addItem(CAMERAS_PATH, {});
          this._pagesController.open(CAMERAS_LIST, cameras.length);
        }}
        @advanced-camera-card:editor:list:item-move=${(
          ev: CustomEvent<{ from: number; to: number }>,
        ) => this._formsController.moveItem(CAMERAS_PATH, ev.detail.from, ev.detail.to)}
        @advanced-camera-card:editor:list:item-delete=${(
          ev: CustomEvent<{ index: number }>,
        ) => this._formsController.deleteItem(CAMERAS_PATH, ev.detail.index)}
      ></advanced-camera-card-editor-list>
    `;
  }

  private _renderCamera(index: number, hidden: boolean): TemplateResult {
    const camera = this._formsController.getList(CAMERAS_PATH)[index];
    const eventsPath: ConfigPath = [CONF_CAMERAS, index, 'triggers', 'events'];
    const events = this._formsController.getList(eventsPath);

    return html`
      <advanced-camera-card-editor-page
        ?hidden=${hidden}
        .heading=${getEditorCameraTitle(index, camera, this.hass)}
        @advanced-camera-card:editor:page:back=${() => this._pagesController.back()}
      >
        ${renderForms(
          this.hass,
          this._formsController.getFormContexts({ kind: 'camera', index }),
        )}
        <ha-expansion-panel
          outlined
          .header=${localize('config.cameras.triggers.editor_label')}
        >
          <advanced-camera-card-icon
            slot="leading-icon"
            .icon=${{ icon: 'mdi:magnify-scan' }}
          ></advanced-camera-card-icon>
          ${this._renderContained(html`
            ${renderDocumentation([CONF_CAMERAS, 'triggers'])}
            ${renderForms(
              this.hass,
              this._formsController.getFormContexts({
                kind: 'camera-triggers',
                cameraIndex: index,
              }),
            )}
            ${this._renderEvents(eventsPath, events)}
          `)}
        </ha-expansion-panel>
      </advanced-camera-card-editor-page>
    `;
  }

  // The Home Assistant events the triggers watch for, a group of their own
  // within the triggers panel: they are one kind of trigger among the others,
  // not a sibling of the whole trigger set.
  private _renderEvents(
    eventsPath: ConfigPath,
    events: readonly unknown[],
  ): TemplateResult {
    return html`
      <ha-expansion-panel
        outlined
        .header=${localize('config.cameras.triggers.events.editor_label')}
      >
        <advanced-camera-card-icon
          slot="leading-icon"
          .icon=${{ icon: 'mdi:home-assistant' }}
        ></advanced-camera-card-icon>
        ${this._renderContained(html`
          <advanced-camera-card-editor-list
            itemIcon="mdi:flash"
            .addLabel=${localize('config.cameras.triggers.events.add_new_event')}
            .items=${events.map((event, eventIndex) => ({
              title: getEditorTriggerEventTitle(eventIndex, event),
            }))}
            @advanced-camera-card:editor:list:item-edit=${(
              ev: CustomEvent<{ index: number }>,
            ) => this._pagesController.open(EVENTS_LIST, ev.detail.index)}
            @advanced-camera-card:editor:list:item-add=${() => {
              // An event filter must name an event type. The empty name the new
              // item starts with matches nothing until the user fills it in.
              this._formsController.addItem(eventsPath, { event_type: '' });
              this._pagesController.open(EVENTS_LIST, events.length);
            }}
            @advanced-camera-card:editor:list:item-move=${(
              ev: CustomEvent<{ from: number; to: number }>,
            ) =>
              this._formsController.moveItem(eventsPath, ev.detail.from, ev.detail.to)}
            @advanced-camera-card:editor:list:item-delete=${(
              ev: CustomEvent<{ index: number }>,
            ) => this._formsController.deleteItem(eventsPath, ev.detail.index)}
          ></advanced-camera-card-editor-list>
        `)}
      </ha-expansion-panel>
    `;
  }

  // A nested panel's expansion and transition events would otherwise reach the
  // panel above and disturb the height it animates to, or collapse it.
  private _renderContained(content: TemplateResult): TemplateResult {
    return html`
      <div
        class="values"
        @transitionend=${this._stopPropagation}
        @expanded-will-change=${this._stopPropagation}
        @expanded-changed=${this._stopPropagation}
      >
        ${content}
      </div>
    `;
  }

  private _stopPropagation(ev: Event): void {
    ev.stopPropagation();
  }

  private _renderEvent(cameraIndex: number, eventIndex: number): TemplateResult {
    const eventsPath: ConfigPath = [CONF_CAMERAS, cameraIndex, 'triggers', 'events'];
    const event = this._formsController.getList(eventsPath)[eventIndex];

    return html`
      <advanced-camera-card-editor-page
        .heading=${getEditorTriggerEventTitle(eventIndex, event)}
        @advanced-camera-card:editor:page:back=${() => this._pagesController.back()}
      >
        ${renderForms(
          this.hass,
          this._formsController.getFormContexts({
            kind: 'camera-event',
            cameraIndex,
            eventIndex,
          }),
        )}
      </advanced-camera-card-editor-page>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(editorExpanderBodyStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-editor-cameras': AdvancedCameraCardEditorCameras;
  }
}
