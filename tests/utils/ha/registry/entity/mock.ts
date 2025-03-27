import { HomeAssistant } from '../../../../../src/ha/types';
import { RegistryCache } from '../../../../../src/utils/ha/registry/cache';
import {
  Entity,
  EntityRegistryManager,
} from '../../../../../src/utils/ha/registry/entity/types';

export class EntityRegistryManagerMock implements EntityRegistryManager {
  protected _cache: RegistryCache<Entity>;
  protected _fetchedEntityList = false;

  constructor(data?: Entity[]) {
    this._cache = new RegistryCache<Entity>((ent) => ent.entity_id);
    this._cache.add(data ?? []);
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
