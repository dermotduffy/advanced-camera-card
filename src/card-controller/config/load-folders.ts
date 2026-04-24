import { CardConfigLoaderAPI } from '../types';

export const setFoldersFromConfig = (api: CardConfigLoaderAPI): void => {
  api.getFoldersManager().deleteFolders();
  try {
    api
      .getFoldersManager()
      .addFolders(api.getConfigManager().getConfig()?.folders ?? []);
  } catch (ev) {
    api.getIssueManager().trigger('config_error', { error: ev });
  }
};
