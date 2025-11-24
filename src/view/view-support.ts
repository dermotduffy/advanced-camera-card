import { CameraManager } from '../camera-manager/manager';
import { CapabilitySearchOptions } from '../camera-manager/types';
import { FoldersManager } from '../card-controller/folders/manager';
import { AdvancedCameraCardView } from '../config/schema/common/const';

/**
 * Get cameraIDs that are relevant for a given view name based on camera
 * capability (if camera specified).
 */
export const getCameraIDsForViewName = (
  viewName: AdvancedCameraCardView,
  cameraManager: CameraManager,
  foldersManager: FoldersManager,
  cameraID?: string,
): Set<string> => {
  const folder = foldersManager.getFolder();

  switch (viewName) {
    case 'diagnostics':
    case 'image':
    case 'media':
      return cameraManager.getStore().getCameraIDs();

    case 'folder':
    case 'folders':
      return folder ? cameraManager.getStore().getCameraIDs() : new Set();

    case 'live':
    case 'clip':
    case 'clips':
    case 'snapshot':
    case 'snapshots':
    case 'recording':
    case 'recordings':
      const options: CapabilitySearchOptions = {
        inclusive: viewName !== 'live',
      };
      const capability =
        viewName === 'clip'
          ? 'clips'
          : viewName === 'snapshot'
            ? 'snapshots'
            : viewName === 'recording'
              ? 'recordings'
              : viewName;
      return cameraID
        ? cameraManager.getStore().getAllDependentCameras(cameraID, capability, options)
        : cameraManager.getStore().getCameraIDsWithCapability(capability, options);

    case 'timeline':
      return folder
        ? cameraManager.getStore().getCameraIDs()
        : cameraManager.getStore().getCameraIDsWithCapability({
            anyCapabilities: ['clips', 'snapshots', 'recordings'],
          });
  }
};

export const isViewSupportedByCamera = (
  view: AdvancedCameraCardView,
  cameraManager: CameraManager,
  foldersManager: FoldersManager,
  cameraID: string,
): boolean => {
  return !!getCameraIDsForViewName(view, cameraManager, foldersManager, cameraID)?.size;
};
