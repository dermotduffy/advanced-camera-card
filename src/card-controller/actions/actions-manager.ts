import { ActionContext } from 'action';
import { z } from 'zod';
import { ConditionsTriggerData } from '../../conditions/types.js';
import {
  ActionConfig,
  Actions,
  ActionsConfig,
  AuxillaryActionConfig,
} from '../../config/schema/actions/types.js';
import { forwardHaptic } from '../../ha/haptic.js';
import {
  getActionConfigGivenAction,
  isAdvancedCameraCardCustomAction,
} from '../../utils/action.js';
import { allPromises } from '../../utils/basic.js';
import { TemplateRenderer } from '../templates/index.js';
import { CardActionsManagerAPI } from '../types.js';
import { ActionSet } from './actions/set.js';
import { ActionExecutionRequest } from './types.js';

const INTERACTIONS = ['tap', 'double_tap', 'hold', 'start_tap', 'end_tap'] as const;
export type InteractionName = (typeof INTERACTIONS)[number];

const interactionSchema = z.object({
  action: z.enum(INTERACTIONS),
});
export type Interaction = z.infer<typeof interactionSchema>;

const interactionEventSchema = z.object({
  detail: interactionSchema,
});

export class ActionsManager {
  protected _api: CardActionsManagerAPI;
  protected _actionsInFlight: ActionSet[] = [];
  protected _actionContext: ActionContext = {};
  protected _templateRenderer: TemplateRenderer | null;

  constructor(api: CardActionsManagerAPI, templateRenderer?: TemplateRenderer) {
    this._api = api;
    this._templateRenderer = templateRenderer ?? null;
  }

  /**
   * Merge card-wide and view-specific actions.
   * @returns A combined set of action.
   */
  public getMergedActions(): ActionsConfig {
    const view = this._api.getViewManager().getView();
    if (this._api.getMessageManager().hasMessage()) {
      return {};
    }

    const config = this._api.getConfigManager().getConfig();
    let specificActions: Actions | undefined = undefined;
    if (view?.is('live')) {
      specificActions = config?.live.actions;
    } else if (view?.isGalleryView()) {
      specificActions = config?.media_gallery?.actions;
    } else if (view?.isViewerView()) {
      specificActions = config?.media_viewer.actions;
    } else if (view?.is('image')) {
      specificActions = config?.image?.actions;
    } else {
      return {};
    }
    return { ...config?.view.actions, ...specificActions };
  }

  /**
   * Handle an human interaction called on an element (e.g. 'tap').
   */
  public handleInteractionEvent = async (ev: Event): Promise<void> => {
    const result = interactionEventSchema.safeParse(ev);
    if (!result.success) {
      return;
    }
    const interaction = result.data.detail.action;
    const config = this.getMergedActions();
    const actionConfig = getActionConfigGivenAction(interaction, config);
    if (
      config &&
      interaction &&
      // Don't execute unless there is explicitly an action defined (as it uses
      // a default that is unhelpful for views that have default tap/click
      // actions).
      actionConfig
    ) {
      await this.executeActions(actionConfig, { config });
    }
  };

  /**
   * This method is called when an ll-custom event is fired. This is used by
   * cards to fire custom actions. This card itself should not call this, but
   * embedded elements may.
   */
  public handleCustomActionEvent = async (
    ev: Event | CustomEvent<ActionConfig>,
  ): Promise<void> => {
    if (!('detail' in ev)) {
      // The event may or may not be a CustomEvent object. For example, whilst
      // this card doesn't use custom-card-helpers, embedded elements may:
      // https://github.com/custom-cards/custom-card-helpers/blob/master/src/fire-event.ts#L70
      return;
    }
    const action: ActionConfig = ev.detail;

    // If the received action is not a custom action specifically for this card
    // to handle, ignore it. Otherwise, we can get action "loops". See:
    // https://github.com/dermotduffy/advanced-camera-card/issues/1969
    if (!isAdvancedCameraCardCustomAction(action)) {
      return;
    }

    await this.executeActions(action);
  };

  /**
   * This method handles actions requested by components of the Advanced Camera
   * Card itself (e.g. menu, PTZ controller).
   */
  public handleActionExecutionRequestEvent = async (
    ev: CustomEvent<ActionExecutionRequest>,
  ): Promise<void> => {
    await this.executeActions(ev.detail.action, {
      config: ev.detail.config,
    });
  };

  public async uninitialize(): Promise<void> {
    // If there are any long-running actions, ensure they are stopped.
    await allPromises(this._actionsInFlight, (actionSet) => actionSet.stop());
  }

  public async executeActions(
    action: ActionConfig | ActionConfig[],
    options?: {
      config?: AuxillaryActionConfig;
      triggerData?: ConditionsTriggerData;
    },
  ): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();
    const renderedAction: ActionConfig | ActionConfig[] =
      hass && this._templateRenderer
        ? (this._templateRenderer.renderRecursively(hass, action, {
            conditionState: this._api.getConditionStateManager().getState(),
            triggerData: options?.triggerData,
          }) as ActionConfig | ActionConfig[])
        : action;

    const actionSet = new ActionSet(this._actionContext, renderedAction, {
      config: options?.config,
      cardID: this._api.getConfigManager().getConfig()?.card_id,
    });

    this._actionsInFlight.push(actionSet);

    try {
      await actionSet.execute(this._api);
      forwardHaptic('success');
    } catch (e) {
      forwardHaptic('warning');
    }
    this._actionsInFlight = this._actionsInFlight.filter((a) => a !== actionSet);
  }
}
