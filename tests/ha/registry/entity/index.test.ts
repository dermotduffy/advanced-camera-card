import { afterEach, describe, expect, it, vi } from 'vitest';

import { EntityRegistryManagerLive } from '../../../../src/ha/registry/entity';
import { EntityCache } from '../../../../src/ha/registry/entity/types';
import { AdvancedCameraCardError } from '../../../../src/types';
import { createHASS, createRegistryEntity } from '../../../test-utils.js';

vi.spyOn(global.console, 'warn').mockImplementation(() => true);

describe('EntityRegistryManager', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getEntity', () => {
    it('should not fetch when cached', async () => {
      const cache = new EntityCache();
      const testEntity = createRegistryEntity({ entity_id: 'test' });

      cache.set('test', testEntity);

      const hass = createHASS();
      const manager = new EntityRegistryManagerLive(cache);
      expect(await manager.getEntity(hass, 'test')).toEqual(testEntity);

      expect(hass.callWS).not.toHaveBeenCalled();
    });

    it('should fetch and cache when not cached', async () => {
      const testEntity = createRegistryEntity({ entity_id: 'test' });

      const hass = createHASS();
      const manager = new EntityRegistryManagerLive(new EntityCache());
      vi.mocked(hass.callWS).mockResolvedValueOnce(testEntity);

      expect(await manager.getEntity(hass, 'test')).toEqual(testEntity);
      expect(hass.callWS).toHaveBeenCalledTimes(1);

      expect(await manager.getEntity(hass, 'test')).toEqual(testEntity);
      expect(hass.callWS).toHaveBeenCalledTimes(1);
    });

    it('should return null when entity does not exist', async () => {
      const hass = createHASS();
      vi.mocked(hass.callWS).mockRejectedValueOnce(new Error('Not found'));

      const manager = new EntityRegistryManagerLive(new EntityCache());
      expect(await manager.getEntity(hass, 'missing')).toBeNull();

      expect(console.warn).toHaveBeenCalledWith(
        expect.any(AdvancedCameraCardError),
        expect.anything(),
      );
    });
  });

  it('getEntities', async () => {
    const cachedEntity = createRegistryEntity({ entity_id: 'cached' });
    const notCachedEntity = createRegistryEntity({ entity_id: 'not-cached' });

    const cache = new EntityCache();
    cache.set('cached', cachedEntity);

    const hass = createHASS();
    const manager = new EntityRegistryManagerLive(cache);
    vi.mocked(hass.callWS).mockResolvedValueOnce(notCachedEntity);
    vi.mocked(hass.callWS).mockRejectedValueOnce(new Error('Not found'));

    expect(await manager.getEntities(hass, ['cached', 'not-cached', 'missing'])).toEqual(
      new Map([
        ['cached', cachedEntity],
        ['not-cached', notCachedEntity],
      ]),
    );

    expect(console.warn).toHaveBeenCalledWith(
      expect.any(AdvancedCameraCardError),
      expect.anything(),
    );
  });

  describe('fetchEntityList', async () => {
    it('should fetch entire entity list once', async () => {
      const hass = createHASS();
      const entity = createRegistryEntity({ entity_id: 'cached' });
      vi.mocked(hass.callWS).mockResolvedValueOnce([entity]);

      const manager = new EntityRegistryManagerLive(new EntityCache());

      await manager.fetchEntityList(hass);

      expect(hass.callWS).toHaveBeenCalledTimes(1);
      expect(hass.callWS).toHaveBeenCalledWith({
        type: 'config/entity_registry/list',
      });

      expect(await manager.getEntity(hass, 'cached')).toEqual(entity);
      expect(hass.callWS).toHaveBeenCalledTimes(1);

      await manager.fetchEntityList(hass);
      expect(hass.callWS).toHaveBeenCalledTimes(1);
    });

    it('should log to console on error', async () => {
      const hass = createHASS();
      vi.mocked(hass.callWS).mockRejectedValueOnce(new Error('Fetch error'));

      const manager = new EntityRegistryManagerLive(new EntityCache());

      await manager.fetchEntityList(hass);

      expect(console.warn).toHaveBeenCalledWith(
        expect.any(AdvancedCameraCardError),
        expect.anything(),
      );
    });
  });

  it('getMatchingEntities', async () => {
    const matchingEntity = createRegistryEntity({ entity_id: 'matching' });
    const notMatchingEntity = createRegistryEntity({ entity_id: 'not-matching' });
    const hass = createHASS();

    vi.mocked(hass.callWS).mockResolvedValueOnce([matchingEntity, notMatchingEntity]);

    const manager = new EntityRegistryManagerLive(new EntityCache());
    expect(
      await manager.getMatchingEntities(
        hass,
        (entity) => entity.entity_id == 'matching',
      ),
    ).toEqual([matchingEntity]);
  });
});
