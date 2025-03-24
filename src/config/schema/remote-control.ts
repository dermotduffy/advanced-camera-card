import { z } from 'zod';

export const remoteControlConfigDefault = {
  entities: {
    camera_priority: 'card' as const,
  },
};

const entityPrioritySchema = z.enum(['card', 'entity']);
export type RemoteControlEntityPriority = z.infer<typeof entityPrioritySchema>;

export const remoteControlConfigSchema = z
  .object({
    entities: z
      .object({
        camera: z.string().startsWith('input_select.').optional(),
        camera_priority: entityPrioritySchema.default(
          remoteControlConfigDefault.entities.camera_priority,
        ),
      })
      .default(remoteControlConfigDefault.entities),
  })
  .default(remoteControlConfigDefault);
