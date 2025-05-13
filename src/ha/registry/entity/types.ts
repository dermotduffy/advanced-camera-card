import { z } from 'zod';
import { HomeAssistant } from '../../types';
import { Cache } from '../../../cache/cache';

export const entitySchema = z.object({
  config_entry_id: z.string().nullable(),
  device_id: z.string().nullable(),
  disabled_by: z.string().nullable(),
  entity_id: z.string(),
  hidden_by: z.string().nullable(),
  platform: z.string(),
  translation_key: z.string().nullable(),
  // Technically the unique_id should be a string, but we want to tolerate
  // numeric unique_ids also in case they are used. See:
  // https://github.com/dermotduffy/advanced-camera-card/issues/1016
  unique_id: z.string().or(z.number()).optional(),
});
export type Entity = z.infer<typeof entitySchema>;

export const entityListSchema = entitySchema.array();
export type EntityList = z.infer<typeof entityListSchema>;

export interface EntityRegistryManager {
  getEntity(hass: HomeAssistant, entityID: string): Promise<Entity | null>;
  getEntities(hass: HomeAssistant, entityIDs: string[]): Promise<Map<string, Entity>>;
  getMatchingEntities(
    hass: HomeAssistant,
    func: (arg: Entity) => boolean,
  ): Promise<Entity[]>;
  fetchEntityList(hass: HomeAssistant): Promise<void>;
}

export class EntityCache extends Cache<string, Entity> {}
