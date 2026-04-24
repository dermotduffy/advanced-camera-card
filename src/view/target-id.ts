import { getStreamCameraID } from '../utils/substream';
import { View } from './view';

// Synthetic target ID used for the image view. The image view has no natural
// per-display identifier (unlike live, which has a camera ID, or the viewer,
// which has a media ID), so a sentinel string is used as its universal key in
// the target-ID namespace. Must not collide with real camera IDs or media IDs.
export const IMAGE_VIEW_TARGET_ID_SENTINEL = '__IMAGE_VIEW__';

// Returns a universal target identifier for the current view — the single key
// used by PTZ/zoom state and media retry epochs to identify "what is currently
// being displayed." Distinct from a raw camera ID because it accounts for
// substreams (live) and the image view sentinel. Media IDs, camera IDs, and
// the image sentinel inhabit distinct namespaces so there are no collisions
// across view types.
export const getViewTargetID = (view: View): string | null => {
  if (view.isViewerView()) {
    return view.queryResults?.getSelectedResult()?.getID() ?? null;
  }
  if (view.is('live')) {
    return getStreamCameraID(view);
  }
  if (view.is('image')) {
    return IMAGE_VIEW_TARGET_ID_SENTINEL;
  }
  return null;
};
