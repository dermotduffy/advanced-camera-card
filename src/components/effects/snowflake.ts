import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import snowflakeStyle from '../../scss/snowflake.scss';

@customElement('advanced-camera-card-snowflake')
export class AdvancedCameraCardSnowflake extends LitElement {
  @property({ type: String })
  public char = '❄';

  @property({ type: String })
  public size = '1em';

  @property({ type: Number })
  public maxOpacity = 1;

  @property({ type: String })
  public fallDuration = '10s';

  @property({ type: String })
  public fallDelay = '0s';

  @property({ type: String })
  public startX = '0%';

  @property({ type: String })
  public endX = '0%';

  protected render(): TemplateResult {
    return html`${this.char}`;
  }

  protected updated(): void {
    this.style.setProperty('--max-opacity', `${this.maxOpacity}`);
    this.style.setProperty('--fall-duration', this.fallDuration);
    this.style.setProperty('--fall-delay', this.fallDelay);
    this.style.setProperty('--start-x', this.startX);
    this.style.setProperty('--end-x', this.endX);
    this.style.fontSize = this.size;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(snowflakeStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-snowflake': AdvancedCameraCardSnowflake;
  }
}
