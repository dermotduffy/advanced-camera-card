import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MotionEyeCameraManagerEngine } from '../../../src/camera-manager/motioneye/engine-motioneye';
import { CameraManagerRequestCache, Engine } from '../../../src/camera-manager/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { BrowseMediaWalker } from '../../../src/ha/browse-media/walker';
import { ResolvedMediaCache } from '../../../src/ha/resolved-media';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';

const createEngine = (): MotionEyeCameraManagerEngine => {
  return new MotionEyeCameraManagerEngine(
    new EntityRegistryManagerMock(),
    mock<StateWatcher>(),
    new BrowseMediaWalker(),
    new ResolvedMediaCache(),
    new CameraManagerRequestCache(),
  );
};

describe('MotionEyeCameraManagerEngine', () => {
  it('should get correct engine type', () => {
    const engine = createEngine();
    expect(engine.getEngineType()).toBe(Engine.MotionEye);
  });
});
