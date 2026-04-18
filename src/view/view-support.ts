import { CameraManager } from '../camera-manager/manager';
import { CapabilitySearchKeys, CapabilitySearchOptions } from '../camera-manager/types';
import { FoldersManager } from '../card-controller/folders/manager';
import { AdvancedCameraCardView } from '../config/schema/common/const';

type ViewSource = 'camera' | 'folder' | 'any';

interface ViewCapabilityRequirements {
  src?: ViewSource;
  mediaCapabilities?: CapabilitySearchKeys;
  mediaCapabilitiesInclusive?: boolean;
}

const anyMedia: ViewCapabilityRequirements = {
  src: 'any',
  mediaCapabilities: {
    anyCapabilities: ['clips', 'snapshots', 'recordings', 'reviews'],
  },
  mediaCapabilitiesInclusive: false,
};
const anyFolder = { src: 'folder' as const };
const noRequirements = {};

const generateCameraRequirements = (
  mediaCapabilities: CapabilitySearchKeys,
  mediaCapabilitiesInclusive = true,
): ViewCapabilityRequirements => {
  return {
    src: 'camera',
    mediaCapabilities,
    mediaCapabilitiesInclusive,
  };
};

const VIEW_REQUIREMENTS: Record<AdvancedCameraCardView, ViewCapabilityRequirements> = {
  live: generateCameraRequirements('live', false),

  clip: generateCameraRequirements('clips'),
  clips: generateCameraRequirements('clips'),
  snapshot: generateCameraRequirements('snapshots'),
  snapshots: generateCameraRequirements('snapshots'),
  recording: generateCameraRequirements('recordings'),
  recordings: generateCameraRequirements('recordings'),
  review: generateCameraRequirements('reviews'),
  reviews: generateCameraRequirements('reviews'),

  gallery: anyMedia,
  media: anyMedia,
  timeline: anyMedia,

  folder: anyFolder,
  folders: anyFolder,

  image: noRequirements,
  diagnostics: noRequirements,
};

export const isViewAvailable = (
  view: AdvancedCameraCardView,
  cameraManager: CameraManager,
  foldersManager: FoldersManager,
): boolean => {
  const req = VIEW_REQUIREMENTS[view];
  const hasCameras = cameraManager.getStore().getCameraIDs().size > 0;
  const hasFolders = foldersManager.hasFolders();

  if (req.src === 'camera') {
    return hasCameras;
  }
  if (req.src === 'folder') {
    return hasFolders;
  }
  if (req.src === 'any') {
    return hasCameras || hasFolders;
  }
  return true;
};

export const doesViewRequireCamera = (view: AdvancedCameraCardView): boolean => {
  return VIEW_REQUIREMENTS[view].src === 'camera';
};

export const getCameraIDsWithCapabilityForView = (
  viewName: AdvancedCameraCardView,
  cameraManager: CameraManager,
  foldersManager: FoldersManager,
  cameraID?: string,
): Set<string> => {
  const requirements = VIEW_REQUIREMENTS[viewName];
  const allCameras = cameraManager.getStore().getCameraIDs();

  if (requirements.src !== 'camera' && requirements.src !== 'any') {
    if (requirements.src === 'folder' && !foldersManager.hasFolders()) {
      return new Set();
    }
    return allCameras;
  }

  if (requirements.src === 'any' && foldersManager.hasFolders()) {
    return allCameras;
  }

  const options: CapabilitySearchOptions = {
    inclusive: !!requirements.mediaCapabilitiesInclusive,
  };
  const capability = requirements.mediaCapabilities;

  /* istanbul ignore next: this path is currently unreachable given the mapping
  in VIEW_REQUIREMENTS includes mediaCapabilities for all camera or 'any'
  related views -- @preserve */
  if (!capability) {
    return allCameras;
  }

  return cameraID
    ? cameraManager.getStore().getAllDependentCameras(cameraID, capability, options)
    : cameraManager.getStore().getCameraIDsWithCapability(capability, options);
};

export const isViewSupportedByCamera = (
  view: AdvancedCameraCardView,
  cameraManager: CameraManager,
  foldersManager: FoldersManager,
  cameraID: string,
): boolean => {
  return !!getCameraIDsWithCapabilityForView(
    view,
    cameraManager,
    foldersManager,
    cameraID,
  )?.size;
};

export const isViewSupported = (
  viewName: AdvancedCameraCardView,
  cameraManager: CameraManager,
  foldersManager: FoldersManager,
  cameraID?: string | null,
): boolean => {
  return (
    isViewAvailable(viewName, cameraManager, foldersManager) &&
    (!cameraID ||
      isViewSupportedByCamera(viewName, cameraManager, foldersManager, cameraID))
  );
};
