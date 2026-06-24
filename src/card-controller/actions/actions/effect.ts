import { EffectActionConfig } from '../../../config/schema/actions/custom/effect';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class EffectAction extends AdvancedCameraCardAction<EffectActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const action = this._getAction();
    switch (action.effect_action) {
      case 'start':
        void api.getEffectsManager().startEffect(action.effect);
        break;
      case 'stop':
        api.getEffectsManager().stopEffect(action.effect);
        break;
      case 'toggle':
        void api.getEffectsManager().toggleEffect(action.effect);
        break;
    }
  }
}
