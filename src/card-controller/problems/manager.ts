import { ConditionStateChange } from '../../conditions/types';
import { HomeAssistant } from '../../ha/types';
import { CardProblemAPI } from '../types';
import { ConfigUpgradeProblem } from './problems/config-upgrade';
import { LegacyResourceProblem } from './problems/legacy-resource';
import { StreamNotLoadingProblem } from './problems/stream-not-loading';
import {
  KeyedProblemResult,
  Problem,
  ProblemDynamicContext,
  ProblemKey,
  ProblemPresence,
  ProblemTriggerContext,
} from './types';

export class ProblemManager {
  private _api: CardProblemAPI;
  private _problems = new Map<ProblemKey, Problem>();
  private _loggedKeys = new Set<ProblemKey>();

  constructor(api: CardProblemAPI) {
    this._api = api;

    this._addProblem(
      new ConfigUpgradeProblem(() => this._api.getConfigManager().getRawConfig()),
    );
    this._addProblem(
      new LegacyResourceProblem(() => this._api.getCardElementManager().update()),
    );
    this._addProblem(
      new StreamNotLoadingProblem(() => this._api.getCardElementManager().update()),
    );
  }

  public initialize(): void {
    this._api.getConditionStateManager().addListener(this._stateChangeHandler);
  }

  public uninitialize(): void {
    this._api.getConditionStateManager().removeListener(this._stateChangeHandler);
  }

  private _addProblem(problem: Problem): void {
    this._problems.set(problem.key, problem);
  }

  public async detectStatic(hass: HomeAssistant): Promise<void> {
    for (const problem of this._problems.values()) {
      await problem.detectStatic?.(hass);
      this._logIfNew(problem);
    }
    this._api.getCardElementManager().update();
  }

  // Silently trigger a problem by key, updating state without user
  // interaction. Use this for system-originated events (e.g. provider errors).
  public trigger(key: ProblemKey, context?: ProblemTriggerContext): void {
    const problem = this._problems.get(key);
    if (!problem) {
      return;
    }
    problem.trigger?.(context);

    // Re-evaluate dynamic state so the trigger could take effect immediately.
    // trigger() only records context (e.g. marking a camera as errored);
    // detectDynamic() decides whether to activate based on current state (e.g.
    // whether it is the selected camera with the error).
    const state = this._api.getConditionStateManager().getState();
    this._detectAllDynamic({
      cameraID: state.camera,
      view: state.view,
      mediaLoaded: !!state.mediaLoadedInfo,
    });
  }

  // Show the notification popup for a problem, regardless of whether or not
  // that problem has triggered (example usecase: the stream is loading and the
  // user clicks the blue loading icon).
  public forceNotify(key: ProblemKey): void {
    const notification = this._problems.get(key)?.getNotification?.();
    if (notification) {
      this._api.getNotificationManager().setNotification(notification);
    }
  }

  public getProblemResults(): KeyedProblemResult[] {
    const results: KeyedProblemResult[] = [];
    for (const problem of this._problems.values()) {
      const result = problem.getResult();
      if (result) {
        results.push({ key: problem.key, problem: result });
      }
    }
    return results;
  }

  public getProblemPresence(): ProblemPresence {
    const presence: ProblemPresence = {};
    for (const problem of this._problems.values()) {
      presence[problem.key] = problem.hasResult();
    }
    return presence;
  }

  public destroy(): void {
    this.uninitialize();
    for (const problem of this._problems.values()) {
      problem.destroy?.();
    }
    this._problems.clear();
  }

  private _stateChangeHandler = (change: ConditionStateChange): void => {
    this._detectAllDynamic({
      cameraID: change.new.camera,
      view: change.new.view,
      mediaLoaded: !!change.new.mediaLoadedInfo,
    });
  };

  private _detectAllDynamic(context: ProblemDynamicContext): void {
    let stateChanged = false;
    for (const problem of this._problems.values()) {
      const hadResult = problem.hasResult();
      problem.detectDynamic?.(context);
      stateChanged ||= problem.hasResult() !== hadResult;
      this._logIfNew(problem);
    }
    if (stateChanged) {
      this._api.getCardElementManager().update();
    }
  }

  private _logIfNew(problem: Problem): void {
    if (problem.hasResult() && !this._loggedKeys.has(problem.key)) {
      this._loggedKeys.add(problem.key);
      const text = problem.getResult()?.notification.text;
      if (text) {
        console.warn(`Advanced Camera Card: ${text}`);
      }
    }
  }
}
