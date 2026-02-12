import { CameraManager } from '../../camera-manager/manager';
import { FoldersManager } from '../../card-controller/folders/manager';
import {
  AdvancedCameraCardUserSpecifiedView,
  AdvancedCameraCardView,
} from '../../config/schema/common/const';

/**
 * Resolve a view name that may be 'auto'.
 * @param viewName The view name.
 * @param cameraManager The camera manager.
 * @param foldersManager The folders manager.
 * @returns A concrete view name.
 */
export const resolveViewName = (
  viewName: AdvancedCameraCardUserSpecifiedView,
  cameraManager: CameraManager,
  foldersManager: FoldersManager,
): AdvancedCameraCardView => {
  if (viewName !== 'auto') {
    return viewName;
  }
  return cameraManager.getStore().getCameraIDs().size
    ? 'live'
    : foldersManager.hasFolders()
      ? 'folders'
      : 'image';
};
