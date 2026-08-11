import type { ActionContext } from 'action';
import { merge } from 'lodash-es';

import type { Action } from '../types';

const setInProgressForThisTarget = (
  targetID: string,
  context: ActionContext,
  contextKey: keyof ActionContext,
  action: Action,
): void => {
  merge(context, {
    [contextKey]: {
      [targetID]: {
        inProgressAction: action,
      },
    },
  });
};

// `action` is registered before the stop is awaited, so an action that starts
// for this target meanwhile sees `action`.
export const replaceInProgressForThisTarget = async (
  targetID: string,
  context: ActionContext,
  contextKey: keyof ActionContext,
  action: Action,
): Promise<void> => {
  const replaced = context[contextKey]?.[targetID]?.inProgressAction;
  setInProgressForThisTarget(targetID, context, contextKey, action);
  await replaced?.stop();
};

// `matcher` decides whether the in-progress action is one this caller may
// stop; on a mismatch the action is left running. Without a matcher, whatever
// is in progress is stopped. The removal is made before the stop is awaited,
// so an action that registers for this target meanwhile is left in place.
export const clearInProgressForThisTarget = async (
  targetID: string,
  context: ActionContext,
  contextKey: keyof ActionContext,
  matcher?: (incumbent: Action) => boolean,
): Promise<void> => {
  const stopped = context[contextKey]?.[targetID]?.inProgressAction;
  if (!stopped || (matcher && !matcher(stopped))) {
    return;
  }
  delete context[contextKey]?.[targetID];
  await stopped.stop();
};
