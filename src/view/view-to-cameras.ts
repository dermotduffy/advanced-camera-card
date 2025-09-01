import { CameraManager } from '../camera-manager/manager';
import { CapabilitySearchOptions } from '../camera-manager/types';
import { AdvancedCameraCardView } from '../config/schema/common/const';

/**
 * Get cameraIDs that are relevant for a given view name based on camera
 * capability (if camera specified).
 */
export const getCameraIDsForViewName = (
  cameraManager: CameraManager,
  viewName: AdvancedCameraCardView,
  cameraID?: string,
): Set<string> => {
  switch (viewName) {
    case 'diagnostics':
    case 'image':
    case 'folder':
    case 'folders':
    case 'media':
      return cameraManager.getStore().getCameraIDs();

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
      return cameraManager.getStore().getCameraIDsWithCapability({
        anyCapabilities: ['clips', 'snapshots', 'recordings'],
      });
  }
};
