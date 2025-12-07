import { EffectActionConfig } from '../../../config/schema/actions/custom/effect';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class EffectAction extends AdvancedCameraCardAction<EffectActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    switch (this._action.effect_action) {
      case 'start':
        api.getEffectsControllerAPI()?.startEffect(this._action.effect);
        break;
      case 'stop':
        api.getEffectsControllerAPI()?.stopEffect(this._action.effect);
        break;
      case 'toggle':
        api.getEffectsControllerAPI()?.toggleEffect(this._action.effect);
        break;
    }
  }
}
