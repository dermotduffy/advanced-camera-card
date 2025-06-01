import { FoldersViewActionConfig } from '../../../config/schema/actions/custom/folders-view';
import { FolderViewQuery } from '../../../view/query';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class FoldersViewAction extends AdvancedCameraCardAction<FoldersViewActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const folder = api.getFoldersManager().getFolder(this._action.folder);
    if (!folder) {
      return;
    }

    const query = api.getFoldersManager().generateDefaultFolderQuery(folder);
    if (!query) {
      return;
    }

    await api.getViewManager().setViewByParametersWithExistingQuery({
      params: {
        // Supports both 'folder' and 'folders' views.
        view: this._action.advanced_camera_card_action,
        query: new FolderViewQuery(query),
      },
    });
  }
}
