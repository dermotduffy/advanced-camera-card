import { HomeAssistant } from '../../../ha/types.js';
import { homeAssistantWSRequest } from '../ws-request.js';
import { IntegrationManifest, integrationManifestSchema } from './types.js';

export const getIntegrationManifest = async (
  hass: HomeAssistant,
  integration: string,
): Promise<IntegrationManifest> => {
  return await homeAssistantWSRequest(hass, integrationManifestSchema, {
    type: 'manifest/get',
    integration: integration,
  });
};
