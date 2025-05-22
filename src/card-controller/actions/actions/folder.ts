import { FolderActionConfig } from '../../../config/schema/actions/custom/folder';
import { FolderViewQuery } from '../../../view/query';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class FolderAction extends AdvancedCameraCardAction<FolderActionConfig> {
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
        view: 'folder',
        query: new FolderViewQuery(query),
      },
    });
  }
}
