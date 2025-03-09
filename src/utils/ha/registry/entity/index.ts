import { HomeAssistant } from '../../../../ha/types.js';
import { errorToConsole } from '../../../basic.js';
import { homeAssistantWSRequest } from '../../ws-request.js';
import { RegistryCache } from '../cache.js';
import { Entity, EntityList, entityListSchema, entitySchema } from './types.js';

export const createEntityRegistryCache = (): RegistryCache<Entity> => {
  return new RegistryCache<Entity>((entity) => entity.entity_id);
};

// This class manages interactions with entities, caching results and fetching
// as necessary. Some calls require every entity to be fetched, which may be
// non-trivial in size (after which they are cached forever).

export class EntityRegistryManager {
  protected _cache: RegistryCache<Entity>;
  protected _fetchedEntityList = false;

  constructor(cache: RegistryCache<Entity>) {
    this._cache = cache;
  }

  public async getEntity(hass: HomeAssistant, entityID: string): Promise<Entity | null> {
    const cachedEntity = this._cache.get(entityID);
    if (cachedEntity) {
      return cachedEntity;
    }

    let entity: Entity | null = null;
    try {
      entity = await homeAssistantWSRequest<Entity>(hass, entitySchema, {
        type: 'config/entity_registry/get',
        entity_id: entityID,
      });
    } catch (e) {
      errorToConsole(e as Error);
      return null;
    }
    this._cache.add(entity);
    return entity;
  }

  public async getMatchingEntities(
    hass: HomeAssistant,
    func: (arg: Entity) => boolean,
  ): Promise<Entity[]> {
    await this.fetchEntityList(hass);
    return this._cache.getMatches(func);
  }

  public async getEntities(
    hass: HomeAssistant,
    entityIDs: string[],
  ): Promise<Map<string, Entity>> {
    const output: Map<string, Entity> = new Map();
    const _storeEntity = async (entityID: string): Promise<void> => {
      const entity = await this.getEntity(hass, entityID);

      if (entity) {
        // When asked to fetch multiple entities, ignore missing entities (they
        // will just not feature in the output).
        output.set(entityID, entity);
      }
    };
    await Promise.all(entityIDs.map(_storeEntity));
    return output;
  }

  public async fetchEntityList(hass: HomeAssistant): Promise<void> {
    if (this._fetchedEntityList) {
      return;
    }

    let entityList: EntityList | null = null;
    try {
      entityList = await homeAssistantWSRequest<EntityList>(hass, entityListSchema, {
        type: 'config/entity_registry/list',
      });
    } catch (e) {
      errorToConsole(e as Error);
      return;
    }
    this._cache.add(entityList);
    this._fetchedEntityList = true;
  }
}
