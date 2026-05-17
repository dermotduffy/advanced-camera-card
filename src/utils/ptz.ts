import { CameraManager } from '../camera-manager/manager';
import { PTZAction } from '../config/schema/actions/custom/ptz';
import { PTZCapabilities } from '../types';
import { getStreamCameraID } from '../view/substream';
import { getViewTargetID } from '../view/target-id';
import { View } from '../view/view';

export type PTZType = 'digital' | 'ptz';
interface PTZTarget {
  targetID: string;
  type: PTZType;
}

export const getPTZTarget = (
  view: View,
  options?: {
    type?: PTZType;
    cameraManager?: CameraManager;
  },
): PTZTarget | null => {
  // PTZ is a playback-layer concern: for live, commands target the *actual*
  // streaming camera (substream-aware), and capability checks must consult
  // the substream too (a base camera with no native PTZ may still expose
  // PTZ via its substream). For viewer/image, the logical view target is
  // already correct.
  const targetID = view.is('live') ? getStreamCameraID(view) : getViewTargetID(view);
  if (!targetID) {
    return null;
  }

  if (view.isViewerView()) {
    return options?.type === 'ptz' ? null : { targetID, type: 'digital' };
  }
  if (view.is('image')) {
    return { targetID, type: 'digital' };
  }
  if (view.is('live')) {
    let type: PTZType = 'digital';
    if (options?.type !== 'digital' && options?.cameraManager) {
      if (hasCameraTruePTZ(options.cameraManager, targetID)) {
        type = 'ptz';
      }
      if (type !== 'ptz' && options?.type === 'ptz') {
        return null;
      }
    }
    return { targetID, type };
  }
  return null;
};

export const hasCameraTruePTZ = (
  cameraManager: CameraManager,
  cameraID: string,
): boolean => {
  return !!cameraManager
    .getStore()
    .getCamera(cameraID)
    ?.getCapabilities()
    ?.hasPTZCapability();
};

export const ptzActionToCapabilityKey = (
  action: PTZAction,
): keyof PTZCapabilities | null => {
  switch (action) {
    case 'left':
    case 'right':
    case 'up':
    case 'down':
      return action;
    case 'zoom_in':
      return 'zoomIn';
    case 'zoom_out':
      return 'zoomOut';
  }
  return null;
};
