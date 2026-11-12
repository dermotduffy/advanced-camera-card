import type { ReadonlyDeep } from 'type-fest';

import type { GeneralActionConfig } from '../../../config/schema/actions/custom/general';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class DownloadAction extends AdvancedCameraCardAction<
  ReadonlyDeep<GeneralActionConfig>
> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const item = api.getViewManager().getView()?.queryResults?.getSelectedResult();
    if (item) {
      await api.getViewItemManager().download(item);
    }
  }
}
