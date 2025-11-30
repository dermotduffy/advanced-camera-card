import { html, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { Timer } from '../../utils/timer';
import { BaseEffectComponent } from './base';
import './firework-burst';

const INITIAL_BURST_COUNT = 3;
const MIN_BURST_COUNT = 2;
const MAX_BURST_COUNT = 5;
const BURST_CYCLE_SECONDS = 2.0;
const MAX_BURST_DELAY_SECONDS = 1.2;

type BurstType = 'standard' | 'ring' | 'palm';

interface BurstConfig {
  id: number;
  posX: string;
  posY: string;
  delay: string;
  scale: number;
  burstType: BurstType;
}

@customElement('advanced-camera-card-effect-fireworks')
export class AdvancedCameraCardEffectFireworks extends BaseEffectComponent {
  @state()
  private _bursts: BurstConfig[] = [];

  private _burstIdCounter = 0;
  private _timer = new Timer();

  public connectedCallback(): void {
    super.connectedCallback();
    this._startFireworks();
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopFireworks();
  }

  private _startFireworks(): void {
    this._createBursts(INITIAL_BURST_COUNT);

    this._timer.startRepeated(BURST_CYCLE_SECONDS, () => {
      const count =
        Math.floor(Math.random() * (MAX_BURST_COUNT - MIN_BURST_COUNT + 1)) +
        MIN_BURST_COUNT;
      this._createBursts(count);
    });
  }

  private _stopFireworks(): void {
    this._timer.stop();
  }

  private _createBursts(count: number): void {
    const newBursts: BurstConfig[] = [];
    for (let i = 0; i < count; i++) {
      newBursts.push(this._createBurstConfig());
    }
    this._bursts = newBursts;
  }

  private _createBurstConfig(): BurstConfig {
    // 20% chance of a big burst (scale 1.5-2.0), otherwise normal (scale 0.8-1.2)
    const isBig = Math.random() < 0.2;
    const scale = isBig ? Math.random() * 0.5 + 1.5 : Math.random() * 0.4 + 0.8;

    // Burst type distribution: 60% standard, 25% ring, 15% palm
    const typeRoll = Math.random();
    let burstType: BurstType;
    if (typeRoll < 0.6) {
      burstType = 'standard';
    } else if (typeRoll < 0.85) {
      burstType = 'ring';
    } else {
      burstType = 'palm';
    }

    return {
      id: this._burstIdCounter++,
      posX: `${Math.random() * 80 + 10}%`,
      posY: `${Math.random() * 60 + 20}%`,
      delay: `${Math.random() * MAX_BURST_DELAY_SECONDS}s`,
      scale,
      burstType,
    };
  }

  protected render(): TemplateResult {
    return html`
      ${repeat(
        this._bursts,
        (burst) => burst.id,
        (burst) => html`
          <advanced-camera-card-firework-burst
            .posX=${burst.posX}
            .posY=${burst.posY}
            .delay=${burst.delay}
            .scale=${burst.scale}
            .burstType=${burst.burstType}
          ></advanced-camera-card-firework-burst>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-effect-fireworks': AdvancedCameraCardEffectFireworks;
  }
}
