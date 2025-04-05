import { TemplateRenderer } from '../card-controller/templates';
import { getConfigValue } from '../config/management';
import { AdvancedCameraCardCondition } from '../config/schema/conditions/types';
import { isCompanionApp } from '../utils/companion';
import {
  ConditionsEvaluationResult,
  ConditionsListener,
  ConditionsManagerReadonlyInterface,
  ConditionState,
  ConditionStateChange,
  ConditionStateManagerReadonlyInterface,
  ConditionsTriggerData,
} from './types';

/**
 * A class to evaluate an array of conditions, and notify listeners when the
 * evaluation changes (a change is either the result changing, or the data
 * associated with a result).
 */
export class ConditionsManager implements ConditionsManagerReadonlyInterface {
  protected _conditions: AdvancedCameraCardCondition[];
  protected _stateManager: ConditionStateManagerReadonlyInterface | null;

  protected _listeners: ConditionsListener[] = [];
  protected _mediaQueries: MediaQueryList[] = [];
  protected _evaluation: ConditionsEvaluationResult = { result: false };
  protected _templateRenderer: TemplateRenderer = new TemplateRenderer();

  constructor(
    conditions: AdvancedCameraCardCondition[],
    stateManager?: ConditionStateManagerReadonlyInterface | null,
  ) {
    this._conditions = conditions;
    conditions.forEach((condition) => {
      if (condition.condition === 'screen') {
        const mql = window.matchMedia(condition.media_query);
        mql.addEventListener('change', this._mediaQueryHandler);
        this._mediaQueries.push(mql);
      }
    });

    this._stateManager = stateManager ?? null;

    // Do an initial condition evaluation, but without calling listeners.
    this._evaluate({ callListeners: false });

    this._stateManager?.addListener(this._stateManagerHandler);
  }

  public destroy(): void {
    this._stateManager?.removeListener(this._stateManagerHandler);

    this._listeners.forEach((l) => this.removeListener(l));

    this._mediaQueries.forEach((mql) =>
      mql.removeEventListener('change', this._mediaQueryHandler),
    );
    this._mediaQueries = [];
    this._conditions = [];
  }

  public addListener(listener: ConditionsListener): void {
    if (!this._listeners.includes(listener)) {
      this._listeners.push(listener);
    }
  }

  public removeListener(listener: ConditionsListener): void {
    this._listeners = this._listeners.filter((l) => l !== listener);
  }

  public getEvaluation(): ConditionsEvaluationResult {
    return this._evaluation;
  }

  protected _mediaQueryHandler = () => this._evaluate();

  protected _stateManagerHandler = (stateChange: ConditionStateChange): void => {
    this._evaluate({ stateChange });
  };

  protected _evaluate(options?: {
    stateChange?: ConditionStateChange;
    callListeners?: boolean;
  }): void {
    const state = options?.stateChange?.new ?? this._stateManager?.getState();

    let result = true;
    let triggerData: ConditionsTriggerData = {};

    for (const condition of this._conditions) {
      const evaluation = this._evaluateCondition(
        condition,
        state,
        options?.stateChange?.old,
      );
      if (!evaluation.result) {
        result = false;
        break;
      }
      triggerData = {
        ...triggerData,
        ...evaluation.triggerData,
      };
    }

    const evaluation: ConditionsEvaluationResult = result
      ? { result, triggerData }
      : { result };

    if (
      evaluation.result !== this._evaluation.result ||
      (evaluation.triggerData && Object.keys(evaluation.triggerData).length)
    ) {
      this._evaluation = evaluation;
      if (options?.callListeners ?? true) {
        this._listeners.forEach(
          (listener) => this._evaluation && listener(this._evaluation),
        );
      }
    }
  }

  protected _evaluateCondition(
    condition: AdvancedCameraCardCondition,
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    switch (condition.condition) {
      case undefined:
      case 'state': {
        const fromState = oldState?.hass?.states?.[condition.entity]?.state;
        const toState = newState?.hass?.states?.[condition.entity]?.state;

        return {
          result:
            (!condition.state && !condition.state_not && toState !== fromState) ||
            ((!!condition.state || !!condition.state_not) &&
              !!toState &&
              (!condition.state ||
                (Array.isArray(condition.state)
                  ? condition.state.includes(toState)
                  : condition.state === toState)) &&
              (!condition.state_not ||
                (Array.isArray(condition.state_not)
                  ? !condition.state_not.includes(toState)
                  : condition.state_not !== toState))),
          ...(fromState !== toState && {
            triggerData: {
              state: {
                entity: condition.entity,
                ...(fromState && { from: fromState }),
                ...(toState && { to: toState }),
              },
            },
          }),
        };
      }
      case 'view': {
        const oldView = oldState?.view;
        const newView = newState?.view;

        return {
          result:
            (!!newView && condition.views?.includes(newView)) ||
            (newView !== oldView && !condition.views?.length),
          ...(oldView !== newView && {
            triggerData: {
              ...((oldState?.view || newState?.view) && {
                view: {
                  ...(oldState?.view && { from: oldState.view }),
                  ...(newState?.view && { to: newState.view }),
                },
              }),
            },
          }),
        };
      }
      case 'fullscreen':
        return {
          result:
            newState?.fullscreen !== undefined &&
            condition.fullscreen === newState.fullscreen,
        };
      case 'expand':
        return {
          result: newState?.expand !== undefined && condition.expand === newState.expand,
        };
      case 'camera': {
        const oldCamera = oldState?.camera;
        const newCamera = newState?.camera;

        return {
          result:
            (!!newCamera && !!condition.cameras?.includes(newCamera)) ||
            (newCamera !== oldCamera && !condition.cameras?.length),
          ...(newCamera !== oldCamera && {
            triggerData: {
              ...((oldState?.camera || newState?.camera) && {
                camera: {
                  ...(oldState?.camera && { from: oldState?.camera }),
                  ...(newState?.camera && { to: newState?.camera }),
                },
              }),
            },
          }),
        };
      }
      case 'numeric_state':
        return {
          result:
            !!newState?.hass?.states &&
            condition.entity in newState.hass?.states &&
            newState.hass.states[condition.entity].state !== undefined &&
            (condition.above === undefined ||
              Number(newState.hass.states[condition.entity].state) > condition.above) &&
            (condition.below === undefined ||
              Number(newState.hass.states[condition.entity].state) < condition.below),
        };
      case 'user':
        return {
          result:
            !!newState?.hass?.user && condition.users.includes(newState.hass.user.id),
        };
      case 'media_loaded':
        return {
          result:
            newState?.mediaLoadedInfo !== undefined &&
            condition.media_loaded === !!newState.mediaLoadedInfo,
        };
      case 'screen':
        return { result: window.matchMedia(condition.media_query).matches };
      case 'display_mode':
        return {
          result:
            !!newState?.displayMode && condition.display_mode === newState.displayMode,
        };
      case 'triggered':
        return {
          result: condition.triggered.some((triggeredCameraID) =>
            newState?.triggered?.has(triggeredCameraID),
          ),
        };
      case 'interaction':
        return {
          result:
            newState?.interaction !== undefined &&
            condition.interaction === newState.interaction,
        };
      case 'microphone':
        return {
          result:
            (condition.connected === undefined ||
              newState?.microphone?.connected === condition.connected) &&
            (condition.muted === undefined ||
              newState?.microphone?.muted === condition.muted),
        };
      case 'key':
        return {
          result:
            !!newState?.keys &&
            condition.key in newState.keys &&
            (condition.state ?? 'down') === newState.keys[condition.key].state &&
            (condition.ctrl === undefined ||
              condition.ctrl === !!newState.keys[condition.key].ctrl) &&
            (condition.alt === undefined ||
              condition.alt === !!newState.keys[condition.key].alt) &&
            (condition.meta === undefined ||
              condition.meta === !!newState.keys[condition.key].meta) &&
            (condition.shift === undefined ||
              condition.shift === !!newState.keys[condition.key].shift),
        };
      case 'user_agent':
        return {
          result:
            !!newState?.userAgent &&
            (!condition.user_agent || condition.user_agent === newState.userAgent) &&
            (condition.companion === undefined ||
              condition.companion === isCompanionApp(newState.userAgent)) &&
            (condition.user_agent_re === undefined ||
              new RegExp(condition.user_agent_re).test(newState.userAgent)),
        };
      case 'config': {
        const newConfig = newState?.config;
        const oldConfig = oldState?.config;

        return {
          result:
            !!newConfig &&
            newConfig !== oldConfig &&
            (!condition.paths?.length ||
              condition.paths.some(
                (key) =>
                  getConfigValue(newConfig, key) !==
                  (oldConfig ? getConfigValue(oldConfig, key) : undefined),
              )),
          ...(newConfig !== oldConfig && {
            triggerData: {
              config: {
                ...((oldState?.config || newState?.config) && {
                  ...(oldState?.config && { from: oldState?.config }),
                  ...(newState?.config && { to: newState?.config }),
                }),
              },
            },
          }),
        };
      }
      case 'initialized':
        return { result: !!newState?.initialized };
      case 'or':
        for (const subCondition of condition.conditions) {
          const evaluation = this._evaluateCondition(subCondition, newState, oldState);
          if (evaluation.result) {
            return evaluation;
          }
        }
        return { result: false };
      case 'and': {
        let triggerData: ConditionsTriggerData = {};
        for (const subCondition of condition.conditions) {
          const evaluation = this._evaluateCondition(subCondition, newState, oldState);
          if (!evaluation.result) {
            return { result: false };
          }
          triggerData = {
            ...triggerData,
            ...evaluation.triggerData,
          };
        }
        return { result: true, triggerData };
      }
      case 'not': {
        // "Not" is just an inversed `and`. There is no trigger data for "not
        // triggering".
        return {
          result: !this._evaluateCondition(
            {
              ...condition,
              condition: 'and',
            },
            newState,
            oldState,
          ).result,
        };
      }
      case 'template':
        return {
          result:
            !!newState?.hass &&
            this._templateRenderer.renderRecursively(
              newState.hass,
              condition.value_template,
              { conditionState: newState },
            ) === true,
        };
    }
  }
}
