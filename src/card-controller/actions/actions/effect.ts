import type { EffectActionConfig } from '../../../config/schema/actions/custom/effect';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class EffectAction extends AdvancedCameraCardAction<EffectActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const action = this._getAction();
    switch (action.effect_action) {
      case 'start':
        // An effect runs for its own duration, so it is deliberately not
        // awaited: doing so would stall the rest of the action set.
        api
          .getEffectsManager()
          .startEffect(action.effect)
          .catch(() => {});
        break;
      case 'stop':
        api.getEffectsManager().stopEffect(action.effect);
        break;
      case 'toggle':
        api
          .getEffectsManager()
          .toggleEffect(action.effect)
          .catch(() => {});
        break;
    }
  }
}
