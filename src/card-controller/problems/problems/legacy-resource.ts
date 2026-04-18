import { z } from 'zod';
import { TROUBLESHOOTING_LEGACY_RESOURCE_URL } from '../../../const.js';
import { HomeAssistant } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import { createInternalCallbackAction } from '../../../utils/action';
import { CardActionsAPI } from '../../types';
import { Problem, ProblemResult } from '../types';

const LEGACY_RESOURCE_FILENAME = 'frigate-hass-card.js';

const ADVANCED_CAMERA_CARD_PATTERN = 'advanced-camera-card.js';

const getResourcePath = (url: string, baseURL: string): string => {
  try {
    return new URL(url, baseURL).pathname;
  } catch {
    // Fallback: strip query string manually.
    const queryIndex = url.indexOf('?');
    return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  }
};

const resourcesSchema = z.array(
  z.object({
    id: z.string(),
    type: z.string(),
    url: z.string(),
  }),
);

export class LegacyResourceProblem implements Problem {
  public readonly key = 'legacy_resource' as const;

  private _legacyResourceIDs: string[] = [];
  private _hasCorrectResource = false;
  private _checked = false;
  private _triggerUpdate: () => void;

  constructor(triggerUpdate: () => void) {
    this._triggerUpdate = triggerUpdate;
  }

  public async detectStatic(hass: HomeAssistant): Promise<void> {
    // Only admin users can view/modify dashboard resources.
    if (!hass.user?.is_admin) {
      return;
    }

    try {
      const rawResources = await hass.callWS({
        type: 'lovelace/resources',
      });

      const parseResult = resourcesSchema.safeParse(rawResources);
      if (!parseResult.success) {
        return;
      }

      this._legacyResourceIDs = [];
      this._hasCorrectResource = false;

      for (const resource of parseResult.data) {
        const path = getResourcePath(resource.url, hass.hassUrl());

        if (path.endsWith(LEGACY_RESOURCE_FILENAME)) {
          this._legacyResourceIDs.push(resource.id);
        }
        if (path.endsWith(ADVANCED_CAMERA_CARD_PATTERN)) {
          this._hasCorrectResource = true;
        }
      }

      this._checked = true;
    } catch {
      // Silently ignore WS failures (e.g. non-admin, connection issues).
    }
  }

  public hasResult(): boolean {
    return this._checked && this._legacyResourceIDs.length > 0;
  }

  public getResult(): ProblemResult | null {
    if (!this.hasResult()) {
      return null;
    }

    const text = this._hasCorrectResource
      ? localize('problems.legacy_resource.text_both')
      : localize('problems.legacy_resource.text_only_legacy');

    return {
      icon: 'mdi:alert',
      severity: 'high',
      notification: {
        heading: {
          text: localize('problems.legacy_resource.heading'),
          icon: 'mdi:alert',
          severity: 'high',
        },
        text,
        link: {
          url: TROUBLESHOOTING_LEGACY_RESOURCE_URL,
          title: localize('problems.troubleshooting_guide'),
        },
        ...(this._hasCorrectResource
          ? {
              controls: [
                {
                  tooltip: localize('problems.legacy_resource.remove'),
                  icon: 'mdi:delete',
                  severity: 'high',
                  actions: {
                    tap_action: createInternalCallbackAction(
                      async (api: CardActionsAPI) => {
                        const hass = api.getHASSManager().getHASS();
                        if (hass) {
                          await this.fix(hass);
                        }
                      },
                    ),
                  },
                  dismiss: true,
                },
              ],
            }
          : {}),
      },
    };
  }

  public async fix(hass: HomeAssistant): Promise<boolean> {
    if (
      !hass.user?.is_admin ||
      !this._hasCorrectResource ||
      !this._legacyResourceIDs.length
    ) {
      return false;
    }

    try {
      await Promise.all(
        this._legacyResourceIDs.map((id) =>
          hass.callWS({
            type: 'lovelace/resources/delete',
            resource_id: id,
          }),
        ),
      );

      // Re-detect to verify removal.
      this._checked = false;
      await this.detectStatic(hass);

      const fixed = !this.hasResult();
      if (fixed) {
        this._triggerUpdate();
      }
      return fixed;
    } catch {
      return false;
    }
  }
}
