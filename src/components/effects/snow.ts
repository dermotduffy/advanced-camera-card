import { html, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { BaseEffectComponent } from './base';
import './snowflake';

const SNOWFLAKE_CHARS = ['❄', '❅', '❆'];
const MAX_SNOWFLAKES = 50;

interface SnowflakeConfig {
  id: number;
  char: string;
  size: string;
  maxOpacity: number;
  fallDuration: string;
  fallDelay: string;
  startX: string;
  endX: string;
}

@customElement('advanced-camera-card-effect-snow')
export class AdvancedCameraCardEffectSnow extends BaseEffectComponent {
  private _snowflakes: SnowflakeConfig[];

  constructor() {
    super();
    this._snowflakes = Array.from({ length: MAX_SNOWFLAKES }, (_, i) => {
      const duration = Math.random() * 10 + 10;
      const delay = -Math.random() * duration * 0.8;
      return {
        id: i,
        char: SNOWFLAKE_CHARS[Math.floor(Math.random() * SNOWFLAKE_CHARS.length)],
        size: `${Math.random() * 1.5 + 0.5}em`,
        maxOpacity: Math.random() * 0.5 + 0.5,
        fallDuration: `${duration}s`,
        fallDelay: `${delay}s`,
        startX: `${Math.random() * 100}%`,
        endX: `${Math.random() * 100}%`,
      };
    });
  }

  protected render(): TemplateResult {
    return html`
      ${repeat(
        this._snowflakes,
        (snowflake) => snowflake.id,
        (snowflake) => html`
          <advanced-camera-card-snowflake
            .char=${snowflake.char}
            .size=${snowflake.size}
            .maxOpacity=${snowflake.maxOpacity}
            .fallDuration=${snowflake.fallDuration}
            .fallDelay=${snowflake.fallDelay}
            .startX=${snowflake.startX}
            .endX=${snowflake.endX}
          ></advanced-camera-card-snowflake>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-effect-snow': AdvancedCameraCardEffectSnow;
  }
}
