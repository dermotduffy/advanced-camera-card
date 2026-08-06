import type { CameraManager } from '../camera-manager/manager';
import { getViewTargetID } from './target-id';
import type { View } from './view';

const isGridLayout = (view: View): boolean =>
  // This reflects whether the view 'asks' for a grid. This is inherited as
  // the user changes view.
  view.isGrid() &&
  // This reflects whether the current view actually *supports* a grid.
  view.supportsMultipleDisplayModes();

// The cameras a live grid lays out, one cell each, or null when live is laid
// out as a single carousel instead (incl. when there's <= 1 camera).
export const getLiveGridCameraIDs = (
  view: View,
  cameraManager: CameraManager,
): Set<string> | null => {
  if (!isGridLayout(view)) {
    return null;
  }

  const cameraIDs = cameraManager.getStore().getCameraIDsWithCapability('live');
  return cameraIDs.size > 1 ? cameraIDs : null;
};

// The cameras a viewer grid lays out, one cell each, or null when the viewer is
// laid out as a single carousel instead (incl. when there's <= 1 camera). The
// cameras come from the query results, so only a camera with media to show gets
// a cell.
export const getViewerGridCameraIDs = (view: View): Set<string> | null => {
  if (!isGridLayout(view)) {
    return null;
  }

  const cameraIDs = view.queryResults?.getCameraIDs();
  return cameraIDs && cameraIDs.size > 1 ? cameraIDs : null;
};

// The target shown in each cell of a grid, or null when the view is not laid
// out as a grid.
const getGridTargetIDs = (
  view: View,
  cameraManager: CameraManager,
): Set<string> | null => {
  if (view.is('live')) {
    // A live cell shows its camera, so the camera is the target.
    return getLiveGridCameraIDs(view, cameraManager);
  }

  if (view.isViewerView()) {
    const cameraIDs = getViewerGridCameraIDs(view);
    if (!cameraIDs) {
      return null;
    }

    // A viewer cell shows one media item belonging to its camera.
    const targetIDs = new Set<string>();
    for (const cameraID of cameraIDs) {
      const targetID = view.queryResults?.getSelectedResult(cameraID)?.getID();
      if (targetID) {
        targetIDs.add(targetID);
      }
    }
    return targetIDs;
  }

  return null;
};

// Every target the current view lays out, one per cell. A grid shows several
// targets at once, so all of them count even when some are scrolled out of the
// viewport: the user chose to put them on screen. Every other layout shows a
// single target at a time, which is the one the view identifies.
export const getDisplayedTargetIDs = (
  view: View,
  cameraManager: CameraManager,
): Set<string> => {
  const gridTargetIDs = getGridTargetIDs(view, cameraManager);
  if (gridTargetIDs) {
    return gridTargetIDs;
  }

  const targetID = getViewTargetID(view);
  return targetID ? new Set([targetID]) : new Set();
};
