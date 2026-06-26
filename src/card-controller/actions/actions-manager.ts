import type { ActionContext } from 'action';
import { z } from 'zod';

import type {
  ActionConfig,
  Actions,
  ActionsConfig,
} from '../../config/schema/actions/types.js';
import { forwardHaptic } from '../../ha/haptic.js';
import {
  getActionConfigGivenAction,
  isAdvancedCameraCardCustomAction,
} from '../../utils/action.js';
import { allPromises, errorToConsole } from '../../utils/basic.js';
import type { CardActionsManagerAPI } from '../types.js';
import { ActionSet } from './actions/set.js';
import type { ActionsExecutionRequest, ActionsExecutor } from './types.js';

const INTERACTIONS = ['tap', 'double_tap', 'hold', 'start_tap', 'end_tap'] as const;
export type InteractionName = (typeof INTERACTIONS)[number];

const interactionSchema = z.object({
  action: z.enum(INTERACTIONS),
});
export type Interaction = z.infer<typeof interactionSchema>;

const interactionEventSchema = z.object({
  detail: interactionSchema,
});

export class ActionsManager implements ActionsExecutor {
  private _api: CardActionsManagerAPI;
  private _actionsInFlight: ActionSet[] = [];
  private _actionContext: ActionContext = {};

  constructor(api: CardActionsManagerAPI) {
    this._api = api;
  }

  /**
   * Merge card-wide and view-specific actions.
   * @returns A combined set of action.
   */
  public getMergedActions(): ActionsConfig {
    const view = this._api.getViewManager().getView();
    // Don't apply view actions when there are full-card/serious issues.
    if (this._api.getIssueManager().getStateManager().hasFullCardIssue()) {
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
      await this.executeActions({ actions: actionConfig, config });
    }
  };

  /**
   * This method is called when an ll-custom event is fired. This is used by
   * cards to fire custom actions. This card itself should not call this, but
   * embedded picture elements may.
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

    await this.executeActions(
      { actions: action },

      // Don't render templates: the picture-elements chain (which may contain
      // third-party elements we don't control) is rendered wholesale when the
      // elements are built, so this action's templates are already resolved.
      // Rendering again would re-evaluate any `{{ }}` that a first render
      // produced.
      false,
    );
  };

  /**
   * This method handles actions requested by components of the Advanced Camera
   * Card itself (e.g. menu, PTZ controller).
   */
  public handleActionExecutionRequestEvent = async (
    ev: CustomEvent<ActionsExecutionRequest>,
  ): Promise<void> => {
    await this.executeActions(ev.detail);
  };

  public async uninitialize(): Promise<void> {
    // If there are any long-running actions, ensure they are stopped.
    await allPromises(this._actionsInFlight, (actionSet) => actionSet.stop());
  }

  // The top-level entry point for running actions: it runs them and emits the
  // user feedback (the haptic) for the gesture. Actions that run further
  // actions (e.g. `if`, `generated_action`) must use `executeNestedActions`.
  public async executeActions(
    request: ActionsExecutionRequest,
    renderTemplates = true,
  ): Promise<void> {
    try {
      // Only give success feedback when an action actually ran, so a gesture
      // that did nothing (everything lock-filtered, or no action matched) stays
      // silent.
      if (await this._runActions(request, renderTemplates)) {
        forwardHaptic('success');
      }
    } catch (e) {
      errorToConsole(e);
      forwardHaptic('warning');
    }
  }

  // Run actions as a nested part of an already-running action (e.g. an `if`
  // branch, or the action a `generated_action` produces). Errors propagate to
  // the top-level `executeActions` (i.e. there's no try/catch here
  // intentionally).
  public async executeNestedActions(request: ActionsExecutionRequest): Promise<void> {
    await this._runActions(request, true);
  }

  private async _runActions(
    request: ActionsExecutionRequest,
    renderTemplates: boolean,
  ): Promise<boolean> {
    const actionSet = new ActionSet(this._actionContext, request.actions, {
      factoryOptions: {
        config: request.config,
        cardID: this._api.getConfigManager().getConfig()?.card_id,
        triggerData: request.triggerData,
      },
      renderTemplates,
    });

    // Track the set in-flight (including nested sets) so `uninitialize` can
    // stop long-running actions on teardown.
    this._actionsInFlight.push(actionSet);
    try {
      return await actionSet.execute(this._api);
    } finally {
      this._actionsInFlight = this._actionsInFlight.filter((a) => a !== actionSet);
    }
  }
}
