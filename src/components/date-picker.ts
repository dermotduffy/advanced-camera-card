import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { localize } from '../localize/localize';
import datePickerStyle from '../scss/date-picker.scss';
import { stopEventFromActivatingCardWideActions } from '../utils/action';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event';
import './icon';

export interface DatePickerEvent {
  date: Date | null;
}

@customElement('advanced-camera-card-date-picker')
export class AdvancedCameraCardDatePicker extends LitElement {
  @property({ attribute: false })
  public icon?: string;

  protected _refInput: Ref<HTMLInputElement> = createRef();

  get value(): Date | null {
    return this._refInput.value?.value ? new Date(this._refInput.value.value) : null;
  }

  public reset(): void {
    if (this._refInput.value) {
      this._refInput.value.value = '';
    }
  }

  protected render(): TemplateResult {
    const changed = () => {
      const value = this._refInput.value?.value;

      fireAdvancedCameraCardEvent<DatePickerEvent>(this, 'date-picker:change', {
        date: value ? new Date(value) : null,
      });
    };

    return html`<input
        aria-label="${localize('timeline.select_date')}"
        title="${localize('timeline.select_date')}"
        ${ref(this._refInput)}
        type="datetime-local"
        @input=${() => changed()}
        @change=${() => changed()}
      />
      <advanced-camera-card-icon
        aria-label="${localize('timeline.select_date')}"
        title="${localize('timeline.select_date')}"
        .icon=${{ icon: this.icon ?? `mdi:calendar-search` }}
        @click=${(ev: Event) => {
          stopEventFromActivatingCardWideActions(ev);
          this._refInput.value?.showPicker();
        }}
      >
      </advanced-camera-card-icon>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(datePickerStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-date-picker': AdvancedCameraCardDatePicker;
  }
}
