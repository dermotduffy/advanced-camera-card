import { describe, expect, it, vi } from 'vitest';

import { getIntegrationManifest } from '../../../src/ha/integration';
import { createHASS } from '../../test-utils';

describe('getIntegrationManifest', () => {
  it('should get integration manifest', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValue({
      domain: 'INTEGRATION',
      version: '1.0',
    });

    expect(await getIntegrationManifest(hass, 'INTEGRATION')).toEqual({
      domain: 'INTEGRATION',
      version: '1.0',
    });
    expect(hass.callWS).toHaveBeenCalledWith({
      type: 'manifest/get',
      integration: 'INTEGRATION',
    });
  });
});
