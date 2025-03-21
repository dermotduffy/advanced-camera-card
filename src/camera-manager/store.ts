import { CameraConfig } from '../config/schema/cameras';
import { CapabilityKey } from '../types';
import { allPromises } from '../utils/basic';
import { ViewMedia } from '../view/media';
import { Camera } from './camera';
import { CameraManagerEngine } from './engine';
import { CapabilitySearchOptions, Engine } from './types';

type CameraManagerEngineCameraIDMap = Map<CameraManagerEngine, Set<string>>;

export interface CameraManagerReadOnlyConfigStore {
  getCameraConfig(cameraID: string): CameraConfig | null;
  getCameraConfigForMedia(media: ViewMedia): CameraConfig | null;

  hasCameraID(cameraID: string): boolean;

  getCamera(cameraID: string): Camera | null;
  getCameras(): Map<string, Camera>;
  getCameraCount(): number;

  getCameraConfigs(cameraIDs?: Iterable<string>): IterableIterator<CameraConfig>;
  getCameraConfigEntries(
    cameraIDs?: Iterable<string>,
  ): IterableIterator<[string, CameraConfig]>;

  getCameraIDs(): Set<string>;
  getDefaultCameraID(): string | null;

  getCameraIDsWithCapability(
    capability: CapabilityKey | CapabilitySearchOptions,
  ): Set<string>;
  getAllDependentCameras(
    cameraID: string,
    capability?: CapabilityKey | CapabilitySearchOptions,
  ): Set<string>;
}

export class CameraManagerStore implements CameraManagerReadOnlyConfigStore {
  protected _cameras: Map<string, Camera> = new Map();
  protected _enginesByType: Map<Engine, CameraManagerEngine> = new Map();

  public addCamera(camera: Camera): void {
    this._cameras.set(camera.getID(), camera);
    this._enginesByType.set(camera.getEngine().getEngineType(), camera.getEngine());
  }

  public async setCameras(cameras: Camera[]): Promise<void> {
    // In setting the store cameras, take great care to replace/add first before
    // remove. Otherwise, there may be race conditions where the card attempts
    // to render a view with (momentarily) no camera.
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/1533

    // Replace/Add the new cameras.
    for (const camera of cameras) {
      const oldCamera = this._cameras.get(camera.getID());
      if (oldCamera !== camera) {
        this.addCamera(camera);
        await oldCamera?.destroy();
      }
    }

    // Remove the old cameras.
    for (const camera of this._cameras.values()) {
      if (!cameras.includes(camera)) {
        await camera.destroy();
        this._cameras.delete(camera.getID());
      }
    }
  }

  public async reset(): Promise<void> {
    await allPromises(this._cameras.values(), (camera) => camera.destroy());
    this._cameras.clear();
    this._enginesByType.clear();
  }

  public getCamera(cameraID: string): Camera | null {
    return this._cameras.get(cameraID) ?? null;
  }
  public getCameras(): Map<string, Camera> {
    return this._cameras;
  }
  public getCameraConfig(cameraID: string): CameraConfig | null {
    return this._cameras.get(cameraID)?.getConfig() ?? null;
  }

  public hasCameraID(cameraID: string): boolean {
    return this._cameras.has(cameraID);
  }

  public getCameraCount(): number {
    return this._cameras.size;
  }

  public getDefaultCameraID(): string | null {
    return this._cameras.keys().next().value ?? null;
  }

  public *getCameraConfigs(
    cameraIDs?: Iterable<string>,
  ): IterableIterator<CameraConfig> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_cameraID, config] of this.getCameraConfigEntries(cameraIDs)) {
      yield config;
    }
  }
  public *getCameraConfigEntries(
    cameraIDs?: Iterable<string>,
  ): IterableIterator<[string, CameraConfig]> {
    for (const cameraID of cameraIDs ?? this._cameras.keys()) {
      const config = this.getCameraConfig(cameraID);

      if (config) {
        yield [cameraID, config];
      }
    }
  }

  public getCameraIDs(): Set<string> {
    return new Set(this._cameras.keys());
  }

  public getCameraIDsWithCapability(
    capability: CapabilityKey | CapabilitySearchOptions,
  ): Set<string> {
    const output: Set<string> = new Set();
    for (const camera of this._cameras.values()) {
      if (camera.getCapabilities()?.matches(capability)) {
        output.add(camera.getID());
      }
    }
    return output;
  }

  public getCameraConfigForMedia(media: ViewMedia): CameraConfig | null {
    return this.getCameraConfig(media.getCameraID());
  }

  public getEngineOfType(engine: Engine): CameraManagerEngine | null {
    return this._enginesByType.get(engine) ?? null;
  }

  public getEngineForCameraID(cameraID: string): CameraManagerEngine | null {
    return this._cameras.get(cameraID)?.getEngine() ?? null;
  }

  public getEnginesForCameraIDs(
    cameraIDs: Set<string>,
  ): CameraManagerEngineCameraIDMap | null {
    const output: CameraManagerEngineCameraIDMap = new Map();

    for (const cameraID of cameraIDs) {
      const engine = this.getEngineForCameraID(cameraID);
      if (!engine) {
        continue;
      }
      if (!output.has(engine)) {
        output.set(engine, new Set());
      }
      output.get(engine)?.add(cameraID);
    }
    return output.size ? output : null;
  }

  public getEngineForMedia(media: ViewMedia): CameraManagerEngine | null {
    return this.getEngineForCameraID(media.getCameraID());
  }

  /**
   * Get all cameras that depend on a given camera.
   * @param cameraManager The camera manager.
   * @param cameraID ID of the target camera.
   * @returns A set of dependent cameraIDs or null (since JS sets guarantee order,
   * the first item in the set is guaranteed to be the cameraID itself).
   */
  public getAllDependentCameras(
    cameraID: string,
    capability?: CapabilitySearchOptions,
  ): Set<string> {
    const visitedCameraIDs = new Set<string>();
    const matchingCameraIDs: Set<string> = new Set();
    const getDependentCameras = (cameraID: string): void => {
      visitedCameraIDs.add(cameraID);

      const camera = this.getCamera(cameraID);
      const cameraConfig = camera?.getConfig();

      if (camera && cameraConfig) {
        if (!capability || camera.getCapabilities()?.matches(capability)) {
          matchingCameraIDs.add(cameraID);
        }
        const dependentCameras: Set<string> = new Set();
        cameraConfig.dependencies.cameras.forEach((item) => dependentCameras.add(item));
        if (cameraConfig.dependencies.all_cameras) {
          this.getCameraIDs().forEach((cameraID) => dependentCameras.add(cameraID));
        }
        for (const dependentCameraID of dependentCameras) {
          if (!visitedCameraIDs.has(dependentCameraID)) {
            getDependentCameras(dependentCameraID);
          }
        }
      }
    };
    getDependentCameras(cameraID);
    return matchingCameraIDs;
  }
}
