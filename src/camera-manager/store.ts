import type { ReadonlyDeep } from 'type-fest';

import type { CameraConfig } from '../config/schema/cameras';
import type { CapabilityKey } from '../types';
import type { ViewMedia } from '../view/item';
import type { Camera } from './camera';
import type { CameraManagerEngine } from './engine';
import type { CapabilitySearchKeys, CapabilitySearchOptions, Engine } from './types';

type CameraManagerEngineCameraIDMap = Map<CameraManagerEngine, Set<string>>;

export interface CameraManagerReadOnlyConfigStore {
  getCameraConfig(cameraID: string): ReadonlyDeep<CameraConfig> | null;
  getCameraForMedia(media: ViewMedia): Camera | null;

  hasCameraID(cameraID: string): boolean;

  getCamera(cameraID: string): Camera | null;
  getCameras(): Map<string, Camera>;
  getCameraCount(): number;

  getCameraConfigs(
    cameraIDs?: Iterable<string>,
  ): IterableIterator<ReadonlyDeep<CameraConfig>>;
  getCameraConfigEntries(
    cameraIDs?: Iterable<string>,
  ): IterableIterator<[string, ReadonlyDeep<CameraConfig>]>;

  getCameraIDs(): Set<string>;
  getDefaultCameraID(): string | null;

  getCameraIDsWithCapability(
    capability: CapabilitySearchKeys,
    options?: CapabilitySearchOptions,
  ): Set<string>;
  getAllDependentCameras(
    cameraID: string,
    capability?: CapabilitySearchKeys,
    options?: CapabilitySearchOptions,
  ): Set<string>;
}

export class CameraManagerStore implements CameraManagerReadOnlyConfigStore {
  private _cameras: Map<string, Camera> = new Map();
  private _enginesByType: Map<Engine, CameraManagerEngine> = new Map();

  /**
   * Set the store's cameras synchronously. The displaced cameras (replaced or
   * removed) are returned for the caller to unsubscribe. The store does not
   * drive camera lifecycle.
   */
  public setCameras(cameras: Camera[]): Camera[] {
    // In setting the store cameras, take great care to replace/add first before
    // remove. Otherwise, there may be race conditions where the card attempts
    // to render a view with (momentarily) no camera.
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/1533

    const displaced: Camera[] = [];

    // Replace/Add the new cameras.
    for (const camera of cameras) {
      const oldCamera = this._cameras.get(camera.getID());
      if (oldCamera !== camera) {
        this._cameras.set(camera.getID(), camera);
        if (oldCamera) {
          displaced.push(oldCamera);
        }
      }
    }

    // Remove the old cameras.
    for (const camera of [...this._cameras.values()]) {
      if (!cameras.includes(camera)) {
        this._cameras.delete(camera.getID());
        displaced.push(camera);
      }
    }

    this._enginesByType = new Map(
      [...this._cameras.values()].map((camera) => [
        camera.getEngine().getEngineType(),
        camera.getEngine(),
      ]),
    );

    return displaced;
  }

  /**
   * Empty the store, returning the removed cameras for the caller to
   * unsubscribe.
   */
  public reset(): Camera[] {
    const cameras = [...this._cameras.values()];
    this._cameras.clear();
    this._enginesByType.clear();
    return cameras;
  }

  public getCamera(cameraID: string): Camera | null {
    return this._cameras.get(cameraID) ?? null;
  }
  public getCameras(): Map<string, Camera> {
    return this._cameras;
  }
  public getCameraConfig(cameraID: string): ReadonlyDeep<CameraConfig> | null {
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
  ): IterableIterator<ReadonlyDeep<CameraConfig>> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_cameraID, config] of this.getCameraConfigEntries(cameraIDs)) {
      yield config;
    }
  }
  public *getCameraConfigEntries(
    cameraIDs?: Iterable<string>,
  ): IterableIterator<[string, ReadonlyDeep<CameraConfig>]> {
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
    capability: CapabilityKey | CapabilitySearchKeys,
    options?: CapabilitySearchOptions,
  ): Set<string> {
    const output: Set<string> = new Set();

    for (const camera of this._cameras.values()) {
      // Must use getAllDependentCameras() to recursively get all relevant
      // cameras respecting the capabilitiy.
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/2122

      this.getAllDependentCameras(camera.getID(), capability, options).forEach(
        (cameraID) => {
          output.add(cameraID);
        },
      );
    }

    return output;
  }

  public getCameraForMedia(media: ViewMedia): Camera | null {
    const cameraID = media.getCameraID();
    return cameraID ? this.getCamera(cameraID) : null;
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
    const cameraID = media.getCameraID();
    return cameraID ? this.getEngineForCameraID(cameraID) : null;
  }

  /**
   * Get all cameras that depend on a given camera, optionally filtered by
   * capability.
   *
   * Iteration order (guaranteed by Set insertion order): if `cameraID` itself
   * passes the capability filter (or no filter is supplied), it is the first
   * element of the returned set. Callers may rely on this ordering to pick a
   * sensible default (e.g. "prefer the parent when eligible, otherwise the
   * first matching dependency").
   *
   * @param cameraID ID of the target camera.
   * @param capabilitySearchKeys Optional capability filter.
   * @param options Optional search options.
   * @returns A set of dependent cameraIDs.
   */
  public getAllDependentCameras(
    cameraID: string,
    capabilitySearchKeys?: CapabilitySearchKeys,
    options?: CapabilitySearchOptions,
  ): Set<string> {
    const visitedCameraIDs = new Set<string>();

    const getDependentCameras = (cameraID: string): Set<string> => {
      visitedCameraIDs.add(cameraID);

      const matchingCameraIDs: Set<string> = new Set();

      const camera = this.getCamera(cameraID);
      const cameraConfig = camera?.getConfig();

      if (!camera || !cameraConfig) {
        return matchingCameraIDs;
      }

      // Gather all dependent cameras...
      const dependentCameras: Set<string> = new Set();
      cameraConfig.dependencies.cameras.forEach((item) => dependentCameras.add(item));
      if (cameraConfig.dependencies.all_cameras) {
        this.getCameraIDs().forEach((cameraID) => dependentCameras.add(cameraID));
      }

      const matchingChildCameraIDs: Set<string> = new Set();

      // ...now recurse through them.
      for (const dependentCameraID of dependentCameras) {
        if (!visitedCameraIDs.has(dependentCameraID)) {
          getDependentCameras(dependentCameraID).forEach((dependentCameraID) =>
            matchingChildCameraIDs.add(dependentCameraID),
          );
        }
      }

      return new Set([
        ...(!capabilitySearchKeys ||
        camera.getCapabilities()?.matches(capabilitySearchKeys) ||
        (options?.inclusive && matchingChildCameraIDs.size)
          ? [cameraID]
          : []),
        ...matchingChildCameraIDs,
      ]);
    };

    return getDependentCameras(cameraID);
  }
}
