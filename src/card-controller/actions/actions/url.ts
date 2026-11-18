import type { ReadonlyDeep } from 'type-fest';

import type { URLActionConfig } from '../../../config/schema/actions/stock/url';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class URLAction extends AdvancedCameraCardAction<ReadonlyDeep<URLActionConfig>> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    window.open(this._getAction().url_path);
  }
}
