import { CameraManagerEngineFactory } from '../../camera-manager/engine-factory';
import { CameraFactory } from '../../camera-manager/factory';
import {
  CameraLifecycleStatus,
  type CameraLifecycleState,
} from '../../camera-manager/lifecycle';
import { recursivelyMergeObjectsNotArrays } from '../../utils/basic';
import type { CardCameraLoaderAPI } from '../types';

/**
 * Build the configured cameras and hand them to the camera manager. This is
 * the only place camera configuration is read: the camera manager itself only
 * ever operates on built `Camera` objects.
 */
export const setCamerasFromConfig = async (
  api: CardCameraLoaderAPI,
  factory?: CameraFactory,
): Promise<void> => {
  const config = api.getConfigManager().getConfig();
  const hass = api.getHASSManager().getHASS();

  if (!config || !hass) {
    return;
  }

  // For each camera merge the config (which has no defaults) into the camera
  // global config (which does have defaults). The merging must happen in this
  // order, to ensure that the defaults in the cameras global config do not
  // override the values specified in the per-camera config.
  const camerasConfig = (config.cameras ?? []).map((camera) =>
    recursivelyMergeObjectsNotArrays(config.cameras_global, camera),
  );

  const cameraFactory =
    factory ??
    new CameraFactory(
      new CameraManagerEngineFactory(
        api.getEntityRegistryManager(),
        api.getDeviceRegistryManager(),
      ),
      {
        hassManager: api.getHASSManager(),
        entityRegistryManager: api.getEntityRegistryManager(),
        resolvedMediaCache: api.getResolvedMediaCache(),
        eventCallback: (ev) => api.getCameraTriggersManager().handleCameraEvent(ev),
      },
    );

  const cameras = await cameraFactory.buildCameras(hass, camerasConfig);

  // A new set of cameras is a new set of trigger sources.
  api.getCameraTriggersManager().reset();

  await api.getCameraManager().setCameras(cameras, {
    engineRequestConcurrency:
      config.performance.features.max_simultaneous_engine_requests,
    lifecycleCallback: (cameraID: string, state: CameraLifecycleState) => {
      if (state.status === CameraLifecycleStatus.Ready) {
        api
          .getCameraTriggersManager()
          .handleCameraLifecycleChange(cameraID)
          .catch(() => {});
        api
          .getViewManager()
          .handleCameraLifecycleChange()
          .catch(() => {});
      }
      api.getCardElementManager().update();
    },
  });
};
