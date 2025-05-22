import {
  Entity,
  EntityCache,
  EntityRegistryManager,
} from '../../../../src/ha/registry/entity/types';
import { HomeAssistant } from '../../../../src/ha/types';

export class EntityRegistryManagerMock implements EntityRegistryManager {
  protected _cache = new EntityCache();
  protected _fetchedEntityList = false;

  constructor(data?: Entity[]) {
    data?.forEach((entity) => {
      this._cache.set(entity.entity_id, entity);
    });
  }

  public async getEntity(
    _hass: HomeAssistant,
    entityID: string,
  ): Promise<Entity | null> {
    return this._cache.get(entityID);
  }

  public async getMatchingEntities(
    _hass: HomeAssistant,
    func: (arg: Entity) => boolean,
  ): Promise<Entity[]> {
    return this._cache.getMatches(func);
  }

  public async getEntities(
    hass: HomeAssistant,
    entityIDs: string[],
  ): Promise<Map<string, Entity>> {
    const output: Map<string, Entity> = new Map();
    for (const entityID of entityIDs) {
      const entityData = await this.getEntity(hass, entityID);
      if (entityData) {
        output.set(entityID, entityData);
      }
    }
    return output;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async fetchEntityList(_hass: HomeAssistant): Promise<void> {}
}
