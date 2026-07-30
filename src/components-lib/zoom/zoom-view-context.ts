import type { ViewContext } from 'view';

import { MergeContextViewModifier } from '../../card-controller/view/modifiers/merge-context.js';
import type { ViewManagerInterface } from '../../card-controller/view/types.js';
import type { PartialZoomSettings, ZoomSettingsObserved } from './types.js';

interface ZoomViewContext {
  observed?: ZoomSettingsObserved;

  // Populate this to request zoom to a particular scale/x/y. An empty object
  // will reset to default, null will make no change. Requests must be written
  // by `ZoomRequestViewModifier` since an empty object needs to mean "reset to
  // default" (and a merged empty object != an assigned empty object).
  requested?: PartialZoomSettings | null;
}

interface ZoomsViewContext {
  [targetID: string]: ZoomViewContext;
}

declare module 'view' {
  interface ViewContext {
    zoom?: ZoomsViewContext;
  }
}

export const generateViewContextForZoom = (
  targetID: string,
  options?: {
    observed?: ZoomSettingsObserved;
    requested?: PartialZoomSettings | null;
  },
): ViewContext | null => {
  return {
    zoom: {
      [targetID]: {
        observed: options?.observed ?? undefined,
        requested: options?.requested ?? null,
      },
    },
  };
};

/**
 * Convenience wrapper to convert zoom settings into a view change
 */
export const handleZoomSettingsObservedEvent = (
  ev: CustomEvent<ZoomSettingsObserved>,
  viewManager?: ViewManagerInterface,
  targetID?: string,
): void => {
  if (!viewManager || !targetID) {
    return;
  }

  viewManager.setViewByParameters({
    modifiers: [
      new MergeContextViewModifier(
        generateViewContextForZoom(targetID, {
          observed: ev.detail,
        }),
      ),
    ],
  });
};
