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
  const capabilityMatchAnyMedia: CapabilitySearchOptions = {
    anyCapabilities: ['clips', 'snapshots', 'recordings'],
  };

  switch (viewName) {
    case 'image':
    case 'diagnostics':
      return cameraManager.getStore().getCameraIDs();

    case 'live':
    case 'clip':
    case 'clips':
    case 'snapshot':
    case 'snapshots':
    case 'recording':
    case 'recordings':
      const capability =
        viewName === 'clip'
          ? 'clips'
          : viewName === 'snapshot'
            ? 'snapshots'
            : viewName === 'recording'
              ? 'recordings'
              : viewName;
      return cameraID
        ? cameraManager.getStore().getAllDependentCameras(cameraID, capability)
        : cameraManager.getStore().getCameraIDsWithCapability(capability);

    case 'timeline':
      return cameraManager
        .getStore()
        .getCameraIDsWithCapability(capabilityMatchAnyMedia);

    case 'media':
      return cameraID
        ? cameraManager
            .getStore()
            .getAllDependentCameras(cameraID, capabilityMatchAnyMedia)
        : cameraManager.getStore().getCameraIDsWithCapability(capabilityMatchAnyMedia);
  }
};
