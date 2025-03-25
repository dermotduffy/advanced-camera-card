import { assert, describe, expect, it, vi } from 'vitest';
import { setRemoteControlEntityFromConfig } from '../../../src/card-controller/config/load-control-entities';
import { INTERNAL_CALLBACK_ACTION } from '../../../src/config/schema/actions/custom/internal';
import { isAdvancedCameraCardCustomAction } from '../../../src/utils/action';
import {
  createCardAPI,
  createConfig,
  createHASS,
  createStateEntity,
  createStore,
} from '../../test-utils';

describe('setRemoteControlEntityFromConfig', () => {
  it('without control entity', () => {
    const api = createCardAPI();
    setRemoteControlEntityFromConfig(api);

    expect(api.getAutomationsManager().deleteAutomations).toBeCalled();
    expect(api.getAutomationsManager().addAutomations).not.toBeCalled();
  });

  it('with control entity and card priority', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        remote_control: {
          entities: {
            camera: 'input_select.camera',
            camera_priority: 'card',
          },
        },
      }),
    );

    setRemoteControlEntityFromConfig(api);

    expect(api.getAutomationsManager().deleteAutomations).toBeCalled();
    expect(api.getAutomationsManager().addAutomations).toBeCalledWith([
      {
        actions: [
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: '__INTERNAL_CALLBACK_ACTION__',
            callback: expect.any(Function),
          },
        ],
        conditions: [
          {
            condition: 'config',
            paths: ['cameras', 'remote_control.entities.camera'],
          },
        ],
        tag: setRemoteControlEntityFromConfig,
      },
      {
        actions: [
          {
            action: 'perform-action',
            data: {
              option: '{{ advanced_camera_card.trigger.camera.to }}',
            },
            perform_action: 'input_select.select_option',
            target: {
              entity_id: 'input_select.camera',
            },
          },
        ],
        conditions: [
          {
            condition: 'camera',
          },
        ],
        tag: setRemoteControlEntityFromConfig,
      },
      {
        actions: [
          {
            action: 'perform-action',
            data: {
              option: '{{ advanced_camera_card.camera }}',
            },
            perform_action: 'input_select.select_option',
            target: {
              entity_id: 'input_select.camera',
            },
          },
        ],
        conditions: [
          {
            condition: 'initialized',
          },
        ],
        tag: setRemoteControlEntityFromConfig,
      },
      {
        actions: [
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'camera_select',
            camera: '{{ advanced_camera_card.trigger.state.to }}',
          },
        ],
        conditions: [
          {
            condition: 'state',
            entity: 'input_select.camera',
          },
        ],
        tag: setRemoteControlEntityFromConfig,
      },
    ]);
  });

  it('with control entity and entity priority', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        remote_control: {
          entities: {
            camera: 'input_select.camera',
            camera_priority: 'entity',
          },
        },
      }),
    );

    setRemoteControlEntityFromConfig(api);

    expect(api.getAutomationsManager().deleteAutomations).toBeCalled();
    expect(api.getAutomationsManager().addAutomations).toBeCalledWith([
      {
        actions: [
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: '__INTERNAL_CALLBACK_ACTION__',
            callback: expect.any(Function),
          },
        ],
        conditions: [
          {
            condition: 'config',
            paths: ['cameras', 'remote_control.entities.camera'],
          },
        ],
        tag: setRemoteControlEntityFromConfig,
      },
      {
        actions: [
          {
            action: 'perform-action',
            data: {
              option: '{{ advanced_camera_card.trigger.camera.to }}',
            },
            perform_action: 'input_select.select_option',
            target: {
              entity_id: 'input_select.camera',
            },
          },
        ],
        conditions: [
          {
            condition: 'camera',
          },
        ],
        tag: setRemoteControlEntityFromConfig,
      },
      {
        actions: [
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'camera_select',
            camera: '{{ hass.states["input_select.camera"].state }}',
          },
        ],
        conditions: [
          {
            condition: 'initialized',
          },
        ],
        tag: setRemoteControlEntityFromConfig,
      },
      {
        actions: [
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'camera_select',
            camera: '{{ advanced_camera_card.trigger.state.to }}',
          },
        ],
        conditions: [
          {
            condition: 'state',
            entity: 'input_select.camera',
          },
        ],
        tag: setRemoteControlEntityFromConfig,
      },
    ]);
  });

  describe('should set options', () => {
    it('should set options when they are incorrect', () => {
      const hass = createHASS();
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          remote_control: {
            entities: {
              camera: 'input_select.camera',
            },
          },
        }),
      );
      const store = createStore([
        {
          cameraID: 'camera.one',
        },
        {
          cameraID: 'camera.two',
        },
      ]);
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(store);

      setRemoteControlEntityFromConfig(api);

      const addOptionsAction = vi.mocked(api.getAutomationsManager().addAutomations).mock
        .calls[0][0][0].actions?.[0];
      assert(addOptionsAction && isAdvancedCameraCardCustomAction(addOptionsAction));
      assert(addOptionsAction.advanced_camera_card_action === INTERNAL_CALLBACK_ACTION);

      addOptionsAction.callback(api);
      expect(hass.callService).toBeCalledWith(
        'input_select',
        'set_options',
        {
          options: ['camera.one', 'camera.two'],
        },
        {
          entity_id: 'input_select.camera',
        },
      );
    });

    it('should not set options when they are already correct', () => {
      const hass = createHASS({
        'input_select.camera': createStateEntity({
          attributes: { options: ['camera.one', 'camera.two'] },
        }),
      });
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          remote_control: {
            entities: {
              camera: 'input_select.camera',
            },
          },
        }),
      );
      const store = createStore([
        {
          cameraID: 'camera.one',
        },
        {
          cameraID: 'camera.two',
        },
      ]);
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(store);

      setRemoteControlEntityFromConfig(api);

      const addOptionsAction = vi.mocked(api.getAutomationsManager().addAutomations).mock
        .calls[0][0][0].actions?.[0];
      assert(addOptionsAction && isAdvancedCameraCardCustomAction(addOptionsAction));
      assert(addOptionsAction.advanced_camera_card_action === INTERNAL_CALLBACK_ACTION);

      addOptionsAction.callback(api);
      expect(hass.callService).not.toBeCalled();
    });
  });
});
