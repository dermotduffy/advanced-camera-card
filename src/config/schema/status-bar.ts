import { z } from 'zod';
import { BUTTON_SIZE_MIN, STATUS_BAR_PRIORITY_DEFAULT } from './common/const';
import { statusBarItemBaseSchema } from './common/status-bar';

export const STATUS_BAR_HEIGHT_MIN = BUTTON_SIZE_MIN;
const STATUS_BAR_STYLES = [
  'none',
  'overlay',
  'hover',
  'hover-card',
  'outside',
  'popup',
] as const;
const STATUS_BAR_POSITIONS = ['top', 'bottom'] as const;

const statusBarItemDefault = {
  priority: STATUS_BAR_PRIORITY_DEFAULT,
  enabled: true,
};

export const statusBarConfigDefault = {
  height: 40,
  items: {
    engine: statusBarItemDefault,
    resolution: statusBarItemDefault,
    severity: statusBarItemDefault,
    technology: statusBarItemDefault,
    title: statusBarItemDefault,
  },
  position: 'bottom' as const,
  style: 'popup' as const,
  popup_seconds: 3,
};

export const statusBarConfigSchema = z
  .object({
    position: z.enum(STATUS_BAR_POSITIONS).default(statusBarConfigDefault.position),
    style: z.enum(STATUS_BAR_STYLES).default(statusBarConfigDefault.style),
    popup_seconds: z
      .number()
      .min(0)
      .max(60)
      .default(statusBarConfigDefault.popup_seconds),
    height: z.number().min(STATUS_BAR_HEIGHT_MIN).default(statusBarConfigDefault.height),
    items: z
      .object({
        engine: statusBarItemBaseSchema.default(statusBarConfigDefault.items.engine),
        technology: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.technology,
        ),
        resolution: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.resolution,
        ),
        severity: statusBarItemBaseSchema.default(statusBarConfigDefault.items.severity),
        title: statusBarItemBaseSchema.default(statusBarConfigDefault.items.title),
      })
      .default(statusBarConfigDefault.items),
  })
  .default(statusBarConfigDefault);
export type StatusBarConfig = z.infer<typeof statusBarConfigSchema>;
