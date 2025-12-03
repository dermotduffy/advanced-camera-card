import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import fireworkBurstStyle from '../../scss/firework-burst.scss';
import './firework-particle';

const BASE_PARTICLE_COUNT = 36;

const FIREWORK_COLORS = [
  '#ff2222', // Bright Red
  '#ffdd00', // Bright Gold
  '#22ff22', // Bright Green
  '#22aaff', // Bright Blue
  '#ff22ff', // Bright Magenta
  '#ffffff', // White
  '#ffaa00', // Bright Orange
  '#22ffff', // Bright Cyan
  '#ff66aa', // Pink
  '#aaaaff', // Lavender
];

type BurstType = 'standard' | 'ring' | 'palm';

interface ParticleConfig {
  id: number;
  angle: number;
  distance: number;
  color: string;
  size: string;
  duration: string;
  delay: string;
  gravity: number;
}

@customElement('advanced-camera-card-firework-burst')
export class AdvancedCameraCardFireworkBurst extends LitElement {
  @property({ type: String })
  public posX = '50%';

  @property({ type: String })
  public posY = '50%';

  @property({ type: String })
  public delay = '0s';

  @property({ type: Number })
  public scale = 1.0;

  @property({ type: String })
  public burstType: BurstType = 'standard';

  private _particles: ParticleConfig[] = [];
  private _color: string = '';
  private _initialized = false;

  private _initializeParticles(): void {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this._color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];

    switch (this.burstType) {
      case 'ring':
        this._initializeRingParticles();
        break;
      case 'palm':
        this._initializePalmParticles();
        break;
      default:
        this._initializeStandardParticles();
    }
  }

  private _initializeStandardParticles(): void {
    const particleCount = Math.round(BASE_PARTICLE_COUNT * this.scale);

    this._particles = Array.from({ length: particleCount }, (_, i) => {
      const baseAngle = (360 / particleCount) * i;
      const angleVariation = (Math.random() - 0.5) * 20;

      return {
        id: i,
        angle: baseAngle + angleVariation,
        distance: (Math.random() * 80 + 100) * this.scale,
        color: this._color,
        size: `${(Math.random() * 12 + 18) * this.scale}px`,
        duration: `${Math.random() * 0.5 + 1.8}s`,
        delay: `${Math.random() * 0.08}s`,
        gravity: 0,
      };
    });
  }

  private _initializeRingParticles(): void {
    const particleCount = Math.round(BASE_PARTICLE_COUNT * this.scale * 1.5);
    const ringDistance = (120 + Math.random() * 40) * this.scale;

    this._particles = Array.from({ length: particleCount }, (_, i) => {
      const baseAngle = (360 / particleCount) * i;

      return {
        id: i,
        angle: baseAngle,
        distance: ringDistance + (Math.random() - 0.5) * 10,
        color: this._color,
        size: `${(Math.random() * 8 + 14) * this.scale}px`,
        duration: `${Math.random() * 0.3 + 1.5}s`,
        delay: `${Math.random() * 0.02}s`,
        gravity: 0,
      };
    });
  }

  private _initializePalmParticles(): void {
    const particleCount = Math.round(18 * this.scale);

    this._particles = Array.from({ length: particleCount }, (_, i) => {
      const baseAngle = (360 / particleCount) * i;
      const angleVariation = (Math.random() - 0.5) * 15;

      return {
        id: i,
        angle: baseAngle + angleVariation,
        distance: (Math.random() * 60 + 140) * this.scale,
        color: this._color,
        size: `${(Math.random() * 10 + 20) * this.scale}px`,
        duration: `${Math.random() * 0.8 + 2.2}s`,
        delay: `${Math.random() * 0.05}s`,
        gravity: 80 + Math.random() * 60,
      };
    });
  }

  protected render(): TemplateResult {
    this._initializeParticles();
    return html`
      ${repeat(
        this._particles,
        (p) => p.id,
        (p) => html`
          <advanced-camera-card-firework-particle
            .angle=${p.angle}
            .distance=${p.distance}
            .color=${p.color}
            .size=${p.size}
            .duration=${p.duration}
            .delay=${p.delay}
            .gravity=${p.gravity}
          ></advanced-camera-card-firework-particle>
        `,
      )}
    `;
  }

  protected updated(): void {
    this.style.setProperty('--pos-x', this.posX);
    this.style.setProperty('--pos-y', this.posY);
    this.style.setProperty('--delay', this.delay);
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(fireworkBurstStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-firework-burst': AdvancedCameraCardFireworkBurst;
  }
}
