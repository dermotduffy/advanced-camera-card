import type { ViewActionConfig } from '../config/schema/actions/custom/view';
import type { AdvancedCameraCardCustomActionConfig } from '../config/schema/actions/types';
import {
  createCameraAction,
  createGeneralAction,
  createSubstreamOffAction,
  createSubstreamOnAction,
  createViewAction,
} from '../utils/action.js';
import type { CardQueryStringAPI } from './types';
import { SubstreamViewModifier } from './view/modifiers/substream';
import type { ViewParametersUserSpecified } from './view/types.js';

interface QueryStringViewIntent {
  view?: ViewParametersUserSpecified & {
    default?: boolean;

    // The substream change to apply alongside the view. Tri-state:
    //   - `undefined`: no substream URL action present, no modifier issued.
    //   - `string`:    `substream_on=X` -- engage stream X.
    //   - `null`:      `substream_off` -- explicitly clear the override.
    stream?: string | null;
  };
  other?: AdvancedCameraCardCustomActionConfig[];
}

export class QueryStringManager {
  private _api: CardQueryStringAPI;
  private _shouldRun = true;

  constructor(api: CardQueryStringAPI) {
    this._api = api;
  }

  public hasViewRelatedActionsToRun(): boolean {
    return !!this._calculateIntent().view && this._shouldRun;
  }

  public requestExecution = (): void => {
    this._shouldRun = true;
    this._api.getCardElementManager().update();
  };

  public executeIfNecessary = async (): Promise<void> => {
    if (this._shouldRun) {
      this._shouldRun = false;
      await this._executeViewRelated(this._calculateIntent());
      await this._executeNonViewRelated(this._calculateIntent());
    }
  };

  private async _executeViewRelated(intent: QueryStringViewIntent): Promise<void> {
    if (intent.view) {
      const modifiers =
        intent.view.stream !== undefined
          ? [
              new SubstreamViewModifier(
                intent.view.stream === null ? {} : { stream: intent.view.stream },
              ),
            ]
          : undefined;
      if (intent.view.default) {
        await this._api.getViewManager().setViewDefaultWithNewQuery({
          params: {
            camera: intent.view.camera,
          },
          ...(modifiers && { modifiers }),
        });
      } else {
        await this._api.getViewManager().setViewByParametersWithNewQuery({
          params: {
            ...(intent.view.view && { view: intent.view.view }),
            ...(intent.view.camera && { camera: intent.view.camera }),
          },
          ...(modifiers && { modifiers }),
        });
      }
    }
  }

  private async _executeNonViewRelated(intent: QueryStringViewIntent): Promise<void> {
    if (intent.other) {
      await this._api.getActionsManager().executeActions({ actions: intent.other });
    }
  }

  private _calculateIntent(): QueryStringViewIntent {
    const result: QueryStringViewIntent = {};
    for (const action of this._getActions()) {
      if (this._isViewAction(action)) {
        (result.view ??= {}).view = action.advanced_camera_card_action;
        (result.view ??= {}).default = undefined;
      } else if (action.advanced_camera_card_action === 'default') {
        (result.view ??= {}).default = true;
        (result.view ??= {}).view = undefined;
      } else if (action.advanced_camera_card_action === 'camera_select') {
        (result.view ??= {}).camera = action.camera;
      } else if (
        action.advanced_camera_card_action === 'substream_on' &&
        action.stream !== undefined
      ) {
        (result.view ??= {}).stream = action.stream;
      } else if (action.advanced_camera_card_action === 'substream_off') {
        (result.view ??= {}).stream = null;
      } else {
        (result.other ??= []).push(action);
      }
    }
    return result;
  }

  private _getActions(): AdvancedCameraCardCustomActionConfig[] {
    const params = new URLSearchParams(window.location.search);
    const actions: AdvancedCameraCardCustomActionConfig[] = [];
    const configuredCardID = this._api.getConfigManager().getConfig()?.card_id;
    const actionRE = new RegExp(
      /^(advanced-camera-card|frigate-card)-action([.:](?<cardID>\w+))?[.:](?<action>\w+)/,
    );
    for (const [key, value] of params.entries()) {
      const match = key.match(actionRE);
      if (!match || !match.groups) {
        continue;
      }
      const cardID: string | undefined = match.groups['cardID'];
      const actionName = match.groups['action'];

      // Skip actions targeted at other cards.
      if (cardID && cardID !== configuredCardID) {
        continue;
      }

      let action: AdvancedCameraCardCustomActionConfig | null = null;
      switch (actionName) {
        case 'camera_select':
          if (value) {
            action = createCameraAction(value, { cardID });
          }
          break;
        case 'substream_on':
          action = createSubstreamOnAction({
            ...(value && { stream: value }),
            cardID,
          });
          break;
        case 'substream_off':
          action = createSubstreamOffAction({ cardID });
          break;
        case 'camera_ui':
        case 'default':
        case 'download':
        case 'expand':
        case 'menu_toggle':
          action = createGeneralAction(actionName, { cardID });
          break;
        case 'clip':
        case 'clips':
        case 'diagnostics':
        case 'folder':
        case 'folders':
        case 'gallery':
        case 'image':
        case 'live':
        case 'media':
        case 'recording':
        case 'recordings':
        case 'review':
        case 'reviews':
        case 'snapshot':
        case 'snapshots':
        case 'timeline':
          action = createViewAction(actionName, { cardID });
          break;
        default:
          console.warn(
            `Advanced Camera Card received unknown card action in query string: ${actionName}`,
          );
      }
      if (action) {
        actions.push(action);
      }
    }
    return actions;
  }

  private _isViewAction = (
    action: AdvancedCameraCardCustomActionConfig,
  ): action is ViewActionConfig => {
    switch (action.advanced_camera_card_action) {
      case 'clip':
      case 'clips':
      case 'diagnostics':
      case 'folder':
      case 'folders':
      case 'gallery':
      case 'image':
      case 'live':
      case 'media':
      case 'recording':
      case 'recordings':
      case 'review':
      case 'reviews':
      case 'snapshot':
      case 'snapshots':
      case 'timeline':
        return true;
    }
    return false;
  };
}
