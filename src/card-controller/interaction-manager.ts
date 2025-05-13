import { throttle } from 'lodash-es';
import { setOrRemoveAttribute } from '../utils/basic';
import { Timer } from '../utils/timer';
import { CardInteractionAPI } from './types';

export class InteractionManager {
  protected _timer = new Timer();
  protected _api: CardInteractionAPI;
  protected _interacted = false;

  constructor(api: CardInteractionAPI) {
    this._api = api;
  }

  // The mouse handler may be called continually, throttle it to at most once
  // per second for performance reasons.
  public reportInteraction = throttle(() => {
    this._reportInteraction();
  }, 1 * 1000);

  public initialize(): void {
    this._setInteraction(false);
  }

  public hasInteraction(): boolean {
    return this._interacted;
  }

  protected _setInteraction(val: boolean): void {
    this._interacted = val;
    setOrRemoveAttribute(
      this._api.getCardElementManager().getElement(),
      val,
      'interaction',
    );
    this._api.getConditionStateManager().setState({ interaction: val });
  }

  protected _reportInteraction(): void {
    this._timer.stop();
    this._setInteraction(true);

    const timeoutSeconds = this._api.getConfigManager().getConfig()
      ?.view.interaction_seconds;
    if (timeoutSeconds) {
      this._timer.start(timeoutSeconds, () => {
        this._setInteraction(false);
      });
    }
  }
}
