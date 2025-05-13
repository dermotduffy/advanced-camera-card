import { CardConfigLoaderAPI } from '../types';

export const setFoldersFromConfig = (api: CardConfigLoaderAPI): void => {
  api.getFoldersManager().deleteFolders();
  try {
    api
      .getFoldersManager()
      .addFolders(api.getConfigManager().getConfig()?.folders ?? []);
  } catch (ev) {
    api.getMessageManager().setErrorIfHigherPriority(ev);
  }
};
