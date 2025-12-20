import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { TPLinkCameraManagerEngine } from '../../../src/camera-manager/tplink/engine-tplink';
import { Engine } from '../../../src/camera-manager/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import { createCameraConfig, createHASS, createRegistryEntity } from '../../test-utils';

const createEngine = (options?: {
  entityRegistryManager?: EntityRegistryManagerMock;
}): TPLinkCameraManagerEngine => {
  return new TPLinkCameraManagerEngine(
    options?.entityRegistryManager ?? new EntityRegistryManagerMock(),
    mock<StateWatcher>(),
  );
};

const cameraEntity = createRegistryEntity({
  entity_id: 'camera.tapo_c520ws_39d3_live_view',
  unique_id: '80115E1CF270233D6FC2FCD4028181A7206CDB30-live_view',
  platform: 'tplink',
  config_entry_id: 'tplink_config_entry_1',
});

const createPopulatedEngine = (): TPLinkCameraManagerEngine => {
  const entityRegistryManager = new EntityRegistryManagerMock([cameraEntity]);
  return createEngine({ entityRegistryManager });
};

describe('TPLinkCameraManagerEngine', () => {
  it('should get correct engine type', () => {
    const engine = createEngine();
    expect(engine.getEngineType()).toBe(Engine.TPLink);
  });

  it('should create camera', async () => {
    const engine = createPopulatedEngine();
    const config = createCameraConfig({
      camera_entity: 'camera.tapo_c520ws_39d3_live_view',
      id: 'tapo_office',
    });

    const camera = await engine.createCamera(createHASS(), config);

    expect(camera.getConfig()).toBe(config);
    expect(camera.getEngine()).toBe(engine);
    expect(camera.getCapabilities()?.getRawCapabilities()).toEqual({
      '2-way-audio': false,
      'remote-control-entity': true,
      live: true,
      menu: true,
      substream: true,
      trigger: true,
    });
  });

  it('should get camera metadata with tplink icon', () => {
    const cameraConfig = createCameraConfig({
      title: 'Tapo Office',
      camera_entity: 'camera.tapo_c520ws_39d3_live_view',
      icon: 'mdi:camera',
    });
    const engine = createEngine();
    expect(engine.getCameraMetadata(createHASS(), cameraConfig)).toEqual({
      engineIcon: 'tplink',
      icon: {
        icon: 'mdi:camera',
        entity: 'camera.tapo_c520ws_39d3_live_view',
        fallback: 'mdi:video',
      },
      title: 'Tapo Office',
    });
  });

  it('should get camera metadata with auto-detected title', () => {
    const cameraConfig = createCameraConfig({
      camera_entity: 'camera.tapo_c520ws_39d3_live_view',
    });
    const hass = createHASS({
      'camera.tapo_c520ws_39d3_live_view': {
        entity_id: 'camera.tapo_c520ws_39d3_live_view',
        state: 'idle',
        attributes: {
          friendly_name: 'Tapo C520WS Live View',
        },
        last_changed: '',
        last_updated: '',
        context: { id: '', user_id: null, parent_id: null },
      },
    });
    const engine = createEngine();
    expect(engine.getCameraMetadata(hass, cameraConfig)).toEqual({
      engineIcon: 'tplink',
      icon: {
        entity: 'camera.tapo_c520ws_39d3_live_view',
        fallback: 'mdi:video',
      },
      title: 'Tapo C520WS Live View',
    });
  });
});
