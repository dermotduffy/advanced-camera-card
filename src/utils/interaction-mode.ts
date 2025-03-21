import { InteractionMode } from '../config/schema/view';

export const isActionAllowedBasedOnInteractionState = (
  interactionMode: InteractionMode,
  interactionState: boolean,
): boolean => {
  switch (interactionMode) {
    case 'all':
      return true;
    case 'active':
      return interactionState;
    case 'inactive':
      return !interactionState;
  }
};
