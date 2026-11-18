import type { HASSManagerReadonlyInterface } from '../card-controller/hass/types';
import type { CameraConfig } from '../config/schema/cameras';
import type { EntityRegistryManager } from '../ha/registry/entity/types';
import type { ResolvedMediaCache } from '../ha/resolved-media';
import type { HomeAssistant } from '../ha/types';
import { allPromises } from '../utils/basic';
import { getCameraID } from '../utils/camera';
import type { Camera } from './camera';
import type { CameraManagerEngine } from './engine';
import type { CameraManagerEngineFactory } from './engine-factory';
import { CameraDuplicateIDError, CameraNoEngineError, CameraNoIDError } from './error';
import type { CameraEventCallback, Engine } from './types';

export interface CameraFactoryOptions {
  hassManager: HASSManagerReadonlyInterface;
  entityRegistryManager: EntityRegistryManager;
  resolvedMediaCache: ResolvedMediaCache;
  eventCallback?: CameraEventCallback;
}

/**
 * Builds uninitialized cameras from camera configurations: resolves each
 * camera's engine and constructs the camera with its ID assigned and validated.
 * No initialization or subscription registration happens here -- `CameraManager`
 * owns the lifecycle of the cameras it is handed.
 */
export class CameraFactory {
  private _engineFactory: CameraManagerEngineFactory;
  private _options: CameraFactoryOptions;

  constructor(engineFactory: CameraManagerEngineFactory, options: CameraFactoryOptions) {
    this._engineFactory = engineFactory;
    this._options = options;
  }

  /**
   * Build an uninitialized camera per config. May throw (no engine, no ID,
   * duplicate ID).
   */
  public async buildCameras(
    hass: HomeAssistant,
    camerasConfig: CameraConfig[],
  ): Promise<Camera[]> {
    const requiresAutoTriggerDetection = camerasConfig.some(
      ({ triggers }) => triggers.motion || triggers.occupancy || triggers.doorbell,
    );

    if (requiresAutoTriggerDetection) {
      // Populate the entity cache by fetching all entities from Home Assistant
      // once upfront, to avoid each camera needing to fetch entity state.
      await this._options.entityRegistryManager.fetchEntityList(hass);
    }

    const engineByConfig = await this._getEnginesForCameras(hass, camerasConfig);

    const cameraIDs = new Set<string>();
    const cameras: Camera[] = [];

    for (const [cameraConfig, engine] of engineByConfig) {
      const camera = engine.createCamera(cameraConfig);
      const cameraID = getCameraID(camera.getConfig());

      if (!cameraID) {
        throw new CameraNoIDError(camera.getConfig());
      }

      if (cameraIDs.has(cameraID)) {
        throw new CameraDuplicateIDError(camera.getConfig());
      }

      // Always ensure the actual ID used in the card is in the configuration itself.
      camera.setID(cameraID);
      cameraIDs.add(cameraID);
      cameras.push(camera);
    }

    return cameras;
  }

  private async _getEnginesForCameras(
    hass: HomeAssistant,
    camerasConfig: CameraConfig[],
  ): Promise<Map<CameraConfig, CameraManagerEngine>> {
    const output: Map<CameraConfig, CameraManagerEngine> = new Map();
    const engines: Map<Engine, CameraManagerEngine> = new Map();

    const engineTypes = await allPromises(camerasConfig, (config) =>
      this._engineFactory.getEngineForCamera(hass, config),
    );

    // Engines are created sequentially, to avoid duplicate creation of the same
    // engine. See: https://github.com/dermotduffy/advanced-camera-card/issues/941
    for (const [index, cameraConfig] of camerasConfig.entries()) {
      const engineType = engineTypes[index];
      const engine = engineType
        ? engines.get(engineType) ??
          (await this._engineFactory.createEngine(engineType, {
            eventCallback: this._options.eventCallback,
            hassManager: this._options.hassManager,
            resolvedMediaCache: this._options.resolvedMediaCache,
          }))
        : null;
      if (!engine || !engineType) {
        throw new CameraNoEngineError(cameraConfig);
      }
      engines.set(engineType, engine);
      output.set(cameraConfig, engine);
    }
    return output;
  }
}
