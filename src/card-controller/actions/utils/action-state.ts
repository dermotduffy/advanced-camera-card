import type { ActionContext } from 'action';
import { merge } from 'lodash-es';

import type { Action, TargetedActionContext } from '../types';

export const stopInProgressForThisTarget = async (
  targetID: string,
  context?: TargetedActionContext,
): Promise<void> => {
  await context?.[targetID]?.inProgressAction?.stop();
};

export const setInProgressForThisTarget = (
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
