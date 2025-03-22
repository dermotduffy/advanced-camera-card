import { CameraManager } from '../camera-manager/manager';
import { PTZAction } from '../config/schema/actions/custom/ptz';
import { IMAGE_VIEW_ZOOM_TARGET_SENTINEL } from '../const';
import { PTZCapabilities } from '../types';
import { View } from '../view/view';
import { getStreamCameraID } from './substream';

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
  if (view.isViewerView()) {
    const targetID = view.queryResults?.getSelectedResult()?.getID() ?? null;
    return options?.type === 'ptz' || !targetID
      ? null
      : {
          targetID: targetID,
          type: 'digital',
        };
  } else if (view.is('live')) {
    const substreamAwareCameraID = getStreamCameraID(view);
    let type: PTZType = 'digital';

    if (options?.type !== 'digital' && options?.cameraManager) {
      if (hasCameraTruePTZ(options.cameraManager, substreamAwareCameraID)) {
        type = 'ptz';
      }
      if (type !== 'ptz' && options?.type === 'ptz') {
        return null;
      }
    }

    return {
      targetID: substreamAwareCameraID,
      type: type,
    };
  } else if (view.is('image')) {
    return {
      targetID: IMAGE_VIEW_ZOOM_TARGET_SENTINEL,
      type: 'digital',
    };
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
