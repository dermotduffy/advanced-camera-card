import type { View } from '../../../view/view';
import type { ViewModifier } from '../types';

// Returns whether any modifier changed the view.
export const applyViewModifiers = (
  view: View,
  modifiers?: ViewModifier[] | null,
): boolean => {
  let modified = false;
  for (const modifier of modifiers ?? []) {
    if (modifier.modify(view)) {
      modified = true;
    }
  }
  return modified;
};
