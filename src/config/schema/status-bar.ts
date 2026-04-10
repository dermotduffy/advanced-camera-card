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
  permanent: false,
};

const statusBarProblemItemDefault = {
  ...statusBarItemDefault,
  permanent: true,
};

export const statusBarConfigDefault = {
  height: 40,
  items: {
    engine: statusBarItemDefault,
    resolution: statusBarItemDefault,
    severity: statusBarItemDefault,
    technology: statusBarItemDefault,
    title: statusBarItemDefault,

    // Problems: permanent by default so the status bar stays visible while
    // problems are active even in popup mode.
    problem_config_error: statusBarProblemItemDefault,
    problem_config_upgrade: statusBarProblemItemDefault,
    problem_connection: statusBarProblemItemDefault,
    problem_initialization: statusBarProblemItemDefault,
    problem_legacy_resource: statusBarProblemItemDefault,
    problem_media_load: statusBarProblemItemDefault,
    problem_media_query: statusBarProblemItemDefault,
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
        resolution: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.resolution,
        ),
        severity: statusBarItemBaseSchema.default(statusBarConfigDefault.items.severity),
        technology: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.technology,
        ),
        title: statusBarItemBaseSchema.default(statusBarConfigDefault.items.title),

        // Problems.
        problem_config_error: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.problem_config_error,
        ),
        problem_config_upgrade: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.problem_config_upgrade,
        ),
        problem_connection: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.problem_connection,
        ),
        problem_initialization: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.problem_initialization,
        ),
        problem_legacy_resource: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.problem_legacy_resource,
        ),
        problem_media_load: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.problem_media_load,
        ),
        problem_media_query: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.problem_media_query,
        ),
      })
      .default(statusBarConfigDefault.items),
  })
  .default(statusBarConfigDefault);
export type StatusBarConfig = z.infer<typeof statusBarConfigSchema>;
