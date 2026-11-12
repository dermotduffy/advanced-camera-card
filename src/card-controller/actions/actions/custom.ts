import type { ReadonlyDeep } from 'type-fest';

import type { CustomActionConfig } from '../../../config/schema/actions/stock/custom';
import { fireHASSEvent } from '../../../ha/fire-hass-event';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class CustomAction extends AdvancedCameraCardAction<
  ReadonlyDeep<CustomActionConfig>
> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    fireHASSEvent(
      api.getCardElementManager().getElement(),
      'll-custom',
      this._getAction(),
    );
  }
}
