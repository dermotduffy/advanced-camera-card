import { html, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { BaseEffectComponent } from './base';
import './shamrock';

const SHAMROCK_COUNT = 10;

interface ShamrockConfig {
  id: number;

  size: string;

  maxOpacity: number;

  pulseDuration: string;
  pulseDelay: string;

  startX: string;
  startY: string;
}

@customElement('advanced-camera-card-effect-shamrocks')
export class AdvancedCameraCardEffectShamrocks extends BaseEffectComponent {
  private _shamrocks: ShamrockConfig[];

  constructor() {
    super();
    this._shamrocks = Array.from({ length: SHAMROCK_COUNT }, (_, i) => {
      const duration = Math.random() * 3 + 5;
      const delay = -Math.random() * duration * 0.9;

      return {
        id: i,
        size: `${Math.random() * 12 + 8}em`,
        maxOpacity: Math.random() * 0.3 + 0.5,
        pulseDuration: `${duration}s`,
        pulseDelay: `${delay}s`,
        startX: `${Math.random() * 80 + 10}%`,
        startY: `${Math.random() * 80 + 10}%`,
      };
    });
  }

  protected render(): TemplateResult {
    return html`
      ${repeat(
        this._shamrocks,
        (shamrock) => shamrock.id,
        (shamrock) => html`
          <advanced-camera-card-shamrock
            .size=${shamrock.size}
            .maxOpacity=${shamrock.maxOpacity}
            .pulseDuration=${shamrock.pulseDuration}
            .pulseDelay=${shamrock.pulseDelay}
            .startX=${shamrock.startX}
            .startY=${shamrock.startY}
          ></advanced-camera-card-shamrock>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-effect-shamrocks': AdvancedCameraCardEffectShamrocks;
  }
}
