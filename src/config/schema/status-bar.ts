import { z } from 'zod';
import { AUTO_HIDE_CONDITIONS } from './common/auto-hide';
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
  permanent: false,
};

// Issues share a single status-bar item config so per-issue granularity
// doesn't leak into the schema/editor surface. Defaults to permanent so the
// status bar stays visible while any issue is active, even in popup mode.
const statusBarIssuesItemDefault = {
  ...statusBarItemDefault,
  permanent: true,
};

// Extend the base schema so the `permanent: true` default survives a user
// override that touches only one sibling field (e.g. `issues.enabled: true`).
// With the item-level default alone, zod would reparse with the base schema's
// field-level `permanent: false` and silently flip the behavior.
const statusBarIssuesItemSchema = statusBarItemBaseSchema.extend({
  permanent: z.boolean().default(true).optional(),
});

export const statusBarConfigDefault = {
  auto_hide: ['call' as const, 'casting' as const],
  height: 40,
  items: {
    engine: statusBarItemDefault,
    issues: statusBarIssuesItemDefault,
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
    auto_hide: z
      .enum(AUTO_HIDE_CONDITIONS)
      .array()
      .default(statusBarConfigDefault.auto_hide),
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
        issues: statusBarIssuesItemSchema.default(statusBarConfigDefault.items.issues),
        resolution: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.resolution,
        ),
        severity: statusBarItemBaseSchema.default(statusBarConfigDefault.items.severity),
        technology: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.technology,
        ),
        title: statusBarItemBaseSchema.default(statusBarConfigDefault.items.title),
      })
      .default(statusBarConfigDefault.items),
  })
  .default(statusBarConfigDefault);
export type StatusBarConfig = z.infer<typeof statusBarConfigSchema>;
