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

// The removal is made before the stop is awaited, so an action that registers
// for this target meanwhile is left in place.
export const clearInProgressForThisTarget = async (
  targetID: string,
  context: ActionContext,
  contextKey: keyof ActionContext,
): Promise<void> => {
  const stopped = context[contextKey]?.[targetID]?.inProgressAction;
  delete context[contextKey]?.[targetID];
  await stopped?.stop();
};
