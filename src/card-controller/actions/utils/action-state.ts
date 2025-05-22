import { merge } from 'lodash-es';
import { Action, TargetedActionContext } from '../types';
import { ActionContext } from 'action';

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
