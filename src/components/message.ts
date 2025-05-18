import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { MessageController } from '../components-lib/message/controller.js';
import messageStyle from '../scss/message.scss';
import { Message } from '../types.js';
import './icon.js';

export function renderMessage(
  message: Message | null,
  renderOptions?: {
    overlay?: boolean;
  },
): TemplateResult {
  return html` <advanced-camera-card-message
    .message=${message}
    ?overlay=${!!renderOptions?.overlay}
  ></advanced-camera-card-message>`;
}
@customElement('advanced-camera-card-message')
export class AdvancedCameraCardMessage extends LitElement {
  @property({ attribute: false })
  public message?: Message;

  @property({ attribute: true, type: Boolean })
  public overlay = false;

  private _controller = new MessageController();

  protected render(): TemplateResult | void {
    if (!this.message) {
      return;
    }

    const url = this._controller.getURL(this.message);
    const messageTemplate = html`
      ${this._controller.getMessageString(this.message)}
      ${url ? html`. <a href="${url.link}">${url.title}</a>` : ''}
    `;

    const icon = this._controller.getIcon(this.message);
    const classes = {
      dotdotdot: !!this.message?.dotdotdot,
    };

    return html` <div class="wrapper">
      <div class="message padded">
        <div class="icon">
          <advanced-camera-card-icon
            part="icon"
            .icon="${{ icon: icon }}"
          ></advanced-camera-card-icon>
        </div>
        <div class="contents">
          <span class="${classMap(classes)}">${messageTemplate}</span>
          ${this._controller
            .getContextStrings(this.message)
            .map((contextItem) => html`<pre>${contextItem}</pre>`)}
        </div>
      </div>
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(messageStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-message': AdvancedCameraCardMessage;
  }
}
