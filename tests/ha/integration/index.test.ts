import { describe, expect, it, vi } from 'vitest';
import { getIntegrationManifest } from '../../../src/ha/integration';
import { integrationManifestSchema } from '../../../src/ha/integration/types';
import { homeAssistantWSRequest } from '../../../src/ha/ws-request.js';
import { createHASS } from '../../test-utils';

vi.mock('../../../src/ha/ws-request.js');

describe('getIntegrationManifest', () => {
  it('should get integration manifest', async () => {
    const hass = createHASS();
    await getIntegrationManifest(hass, 'INTEGRATION');
    expect(homeAssistantWSRequest).toHaveBeenCalledWith(
      hass,
      integrationManifestSchema,
      { type: 'manifest/get', integration: 'INTEGRATION' },
    );
  });
});
