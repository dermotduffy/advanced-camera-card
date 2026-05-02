import { View } from './view';

// Synthetic target ID used for the image view. The image view has no natural
// per-display identifier (unlike live, which has a camera ID, or the viewer,
// which has a media ID), so a sentinel string is used as its universal key in
// the target-ID namespace. Must not collide with real camera IDs or media IDs.
export const IMAGE_VIEW_TARGET_ID_SENTINEL = '__IMAGE_VIEW__';

// Returns a universal target identifier for the current view — the single key
// used by PTZ/zoom state and media retry epochs to identify "what is currently
// being displayed." For live, this is the *base* camera ID (substream is an
// implementation detail of how to play camera X, not a separate logical
// identity — see `getStreamCameraID` for the substream-aware variant used
// only inside the playback chain).
export const getViewTargetID = (view: View): string | null => {
  if (view.isViewerView()) {
    return view.queryResults?.getSelectedResult()?.getID() ?? null;
  }
  if (view.is('live')) {
    return view.camera;
  }
  if (view.is('image')) {
    return IMAGE_VIEW_TARGET_ID_SENTINEL;
  }
  return null;
};
