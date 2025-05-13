import { CardConfigLoaderAPI } from '../types';

export const setAutomationsFromConfig = (api: CardConfigLoaderAPI): void => {
  api.getAutomationsManager().deleteAutomations();
  api
    .getAutomationsManager()
    .addAutomations(api.getConfigManager().getNonOverriddenConfig()?.automations ?? []);
};
