import { html, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { BaseEffectComponent } from './base';
import './heart';

const HEART_CHARS = ['❤️', '💖', '💕', '💗', '💓'];
const HEART_MAX_COUNT = 50;

interface HeartConfig {
  id: number;
  char: string;

  size: string;

  hue: number;
  saturation: number;
  lightness: number;

  maxOpacity: number;

  pulseDuration: string;
  pulseDelay: string;

  startX: string;
  startY: string;
}

@customElement('advanced-camera-card-effect-hearts')
export class AdvancedCameraCardEffectHearts extends BaseEffectComponent {
  private _hearts: HeartConfig[];

  constructor() {
    super();
    this._hearts = Array.from({ length: HEART_MAX_COUNT }, (_, i) => {
      const duration = Math.random() * 4 + 4;
      const delay = -Math.random() * duration * 0.8;

      return {
        id: i,
        char: HEART_CHARS[Math.floor(Math.random() * HEART_CHARS.length)],
        size: `${Math.random() * 1.5 + 0.5}em`,
        hue: Math.random() * 40 + 320,
        saturation: Math.random() * 40 + 60,
        lightness: Math.random() * 20 + 45,
        maxOpacity: Math.random() * 0.5 + 0.2,
        pulseDuration: `${duration}s`,
        pulseDelay: `${delay}s`,
        startX: `${Math.random() * 100}%`,
        startY: `${Math.random() * 100}%`,
      };
    });
  }

  protected render(): TemplateResult {
    return html`
      ${repeat(
        this._hearts,
        (heart) => heart.id,
        (heart) => html`
          <advanced-camera-card-heart
            .char=${heart.char}
            .size=${heart.size}
            .hue=${heart.hue}
            .saturation=${heart.saturation}
            .lightness=${heart.lightness}
            .maxOpacity=${heart.maxOpacity}
            .pulseDuration=${heart.pulseDuration}
            .pulseDelay=${heart.pulseDelay}
            .startX=${heart.startX}
            .startY=${heart.startY}
          ></advanced-camera-card-heart>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-effect-hearts': AdvancedCameraCardEffectHearts;
  }
}
