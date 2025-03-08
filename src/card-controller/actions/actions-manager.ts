import { ActionContext } from 'action';
import { z } from 'zod';
import { ConditionsTriggerData } from '../../conditions/types.js';
import { Actions, ActionsConfig, ActionType } from '../../config/types.js';
import { getActionConfigGivenAction } from '../../utils/action.js';
import { TemplateRenderer } from '../templates/index.js';
import { CardActionsManagerAPI } from '../types.js';
import { ActionSet } from './actions/set.js';
import { ActionExecutionRequest, AuxillaryActionConfig } from './types.js';

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
  public handleInteractionEvent = (ev: Event): void => {
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
      this.executeActions(actionConfig, { config });
    }
  };

  /**
   * This method is called when an ll-custom event is fired. This is used by
   * cards to fire custom actions. This card itself should not call this, but
   * embedded elements may.
   */
  public handleCustomActionEvent = (ev: Event): void => {
    if (!('detail' in ev)) {
      // The event may not be a CustomEvent object, see:
      // https://github.com/custom-cards/custom-card-helpers/blob/master/src/fire-event.ts#L70
      return;
    }
    this.executeActions(ev.detail as ActionType);
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

  public uninitialize(): void {
    // If there are any long-running actions, ensure they are stopped.
    this._actionsInFlight.forEach((actionSet) => actionSet.stop());
  }

  public async executeActions(
    action: ActionType | ActionType[],
    options?: {
      config?: AuxillaryActionConfig;
      triggerData?: ConditionsTriggerData;
    },
  ): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();
    const renderedAction =
      hass && this._templateRenderer
        ? this._templateRenderer.renderRecursively(hass, action, {
            conditionState: this._api.getConditionStateManager().getState(),
            triggerData: options?.triggerData,
          })
        : action;

    const actionSet = new ActionSet(this._actionContext, renderedAction, {
      config: options?.config,
      cardID: this._api.getConfigManager().getConfig()?.card_id,
    });

    this._actionsInFlight.push(actionSet);
    await actionSet.execute(this._api);
    this._actionsInFlight = this._actionsInFlight.filter((a) => a !== actionSet);
  }
}
