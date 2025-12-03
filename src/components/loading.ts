import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import loadingStyle from '../scss/loading.scss';
import { EffectName, EffectsControllerAPI } from '../types';
import { getReleaseVersion } from '../utils/diagnostics';
import './icon';

// Map of "MM-DD" to effect name for special dates.
const DATE_EFFECTS: Record<string, EffectName> = {
  // New Year's Day
  '01-01': 'fireworks',

  // Valentine's Day
  '02-14': 'hearts',

  // St. Patrick's Day
  '03-17': 'shamrocks',

  // Halloween
  '10-31': 'ghost',

  // Christmas
  '12-25': 'snow',
};

const getDateEffect = (): EffectName | null => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return DATE_EFFECTS[`${month}-${day}`] ?? null;
};

@customElement('advanced-camera-card-loading')
export class AdvancedCameraCardLoading extends LitElement {
  @property({ attribute: false })
  public effectsControllerAPI?: EffectsControllerAPI | null;

  @property({ type: Boolean, reflect: true })
  public loaded = false;

  private _effectName: EffectName | null = null;

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopEffect();
  }

  protected updated(): void {
    const effect = getDateEffect();
    if (!effect) {
      return;
    }

    if (!this.loaded) {
      this._startEffect(effect);
    } else {
      this._stopEffect();
    }
  }

  private _startEffect(effect: EffectName): void {
    this.effectsControllerAPI?.startEffect(effect, { fadeIn: false });
    this._effectName = effect;
  }

  private _stopEffect(): void {
    if (this._effectName) {
      this.effectsControllerAPI?.stopEffect(this._effectName);
    }
    this._effectName = null;
  }

  protected render(): TemplateResult {
    return html`<advanced-camera-card-icon
        .icon=${{ icon: 'iris' }}
      ></advanced-camera-card-icon
      ><span>${getReleaseVersion()}</span>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(loadingStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-loading': AdvancedCameraCardLoading;
  }
}
