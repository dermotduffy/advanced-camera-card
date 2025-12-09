import { describe, expect, it, vi } from 'vitest';
import { setRemoteControlEntityFromConfig } from '../../../src/card-controller/config/load-control-entities';
import {
  INTERNAL_CALLBACK_ACTION,
  InternalCallbackActionConfig,
} from '../../../src/config/schema/actions/custom/internal';
import { isAdvancedCameraCardCustomAction } from '../../../src/utils/action';
import {
  createCardAPI,
  createConfig,
  createHASS,
  createStateEntity,
  createStore,
  createView,
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
            action: 'fire-dom-event',
            advanced_camera_card_action: '__INTERNAL_CALLBACK_ACTION__',
            callback: expect.any(Function),
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
            advanced_camera_card_action: '__INTERNAL_CALLBACK_ACTION__',
            callback: expect.any(Function),
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
            action: 'fire-dom-event',
            advanced_camera_card_action: '__INTERNAL_CALLBACK_ACTION__',
            callback: expect.any(Function),
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
        .calls[0][0][0].actions?.[0] as InternalCallbackActionConfig;
      expect(addOptionsAction).toBeTruthy();
      expect(isAdvancedCameraCardCustomAction(addOptionsAction)).toBeTruthy();
      expect(addOptionsAction.advanced_camera_card_action).toBe(
        INTERNAL_CALLBACK_ACTION,
      );

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
        .calls[0][0][0].actions?.[0] as InternalCallbackActionConfig;
      expect(addOptionsAction).toBeTruthy();
      expect(isAdvancedCameraCardCustomAction(addOptionsAction)).toBeTruthy();
      expect(addOptionsAction.advanced_camera_card_action).toBe(
        INTERNAL_CALLBACK_ACTION,
      );

      addOptionsAction.callback(api);
      expect(hass.callService).not.toBeCalled();
    });

    it('should not throw when hass is undefined setting options', () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
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
        .calls[0][0][0].actions?.[0] as InternalCallbackActionConfig;
      expect(addOptionsAction).toBeTruthy();
      expect(isAdvancedCameraCardCustomAction(addOptionsAction)).toBeTruthy();
      expect(addOptionsAction.advanced_camera_card_action).toBe(
        INTERNAL_CALLBACK_ACTION,
      );

      // Should not throw
      addOptionsAction.callback(api);
    });
  });

  describe('should select option on entity', () => {
    it('should select option when camera differs from entity state', () => {
      const hass = createHASS({
        'input_select.camera': createStateEntity({
          state: 'camera.one',
        }),
      });
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
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
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          camera: 'camera.two',
          view: 'live',
        }),
      );

      setRemoteControlEntityFromConfig(api);

      // Get the camera sync callback (automation index 1)
      const cameraSyncAction = vi.mocked(api.getAutomationsManager().addAutomations).mock
        .calls[0][0][1].actions?.[0] as InternalCallbackActionConfig;
      expect(cameraSyncAction).toBeTruthy();
      expect(isAdvancedCameraCardCustomAction(cameraSyncAction)).toBeTruthy();
      expect(cameraSyncAction.advanced_camera_card_action).toBe(
        INTERNAL_CALLBACK_ACTION,
      );

      cameraSyncAction.callback(api);
      expect(hass.callService).toBeCalledWith(
        'input_select',
        'select_option',
        {
          option: 'camera.two',
        },
        {
          entity_id: 'input_select.camera',
        },
      );
    });

    it('should not select option when camera matches entity state', () => {
      const hass = createHASS({
        'input_select.camera': createStateEntity({
          state: 'camera.one',
        }),
      });
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
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
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          camera: 'camera.one',
          view: 'live',
        }),
      );

      setRemoteControlEntityFromConfig(api);

      // Get the camera sync callback (automation index 1)
      const cameraSyncAction = vi.mocked(api.getAutomationsManager().addAutomations).mock
        .calls[0][0][1].actions?.[0] as InternalCallbackActionConfig;
      expect(cameraSyncAction).toBeTruthy();
      expect(isAdvancedCameraCardCustomAction(cameraSyncAction)).toBeTruthy();
      expect(cameraSyncAction.advanced_camera_card_action).toBe(
        INTERNAL_CALLBACK_ACTION,
      );

      cameraSyncAction.callback(api);

      // Should NOT call select_option since entity already shows camera.one
      expect(hass.callService).not.toBeCalled();
    });

    it('should not select option when camera is undefined', () => {
      const hass = createHASS({
        'input_select.camera': createStateEntity({
          state: 'camera.one',
        }),
      });
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
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
      vi.mocked(api.getViewManager().getView).mockReturnValue(null);

      setRemoteControlEntityFromConfig(api);

      // Get the camera sync callback (automation index 1)
      const cameraSyncAction = vi.mocked(api.getAutomationsManager().addAutomations).mock
        .calls[0][0][1].actions?.[0] as InternalCallbackActionConfig;
      expect(cameraSyncAction).toBeTruthy();
      expect(isAdvancedCameraCardCustomAction(cameraSyncAction)).toBeTruthy();
      expect(cameraSyncAction.advanced_camera_card_action).toBe(
        INTERNAL_CALLBACK_ACTION,
      );

      cameraSyncAction.callback(api);

      // Should NOT call select_option since camera is undefined
      expect(hass.callService).not.toBeCalled();
    });

    it('should not throw when hass is undefined', () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
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
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          camera: 'camera.two',
          view: 'live',
        }),
      );

      setRemoteControlEntityFromConfig(api);

      const cameraSyncAction = vi.mocked(api.getAutomationsManager().addAutomations).mock
        .calls[0][0][1].actions?.[0] as InternalCallbackActionConfig;
      expect(cameraSyncAction).toBeTruthy();
      expect(isAdvancedCameraCardCustomAction(cameraSyncAction)).toBeTruthy();
      expect(cameraSyncAction.advanced_camera_card_action).toBe(
        INTERNAL_CALLBACK_ACTION,
      );

      // Should not throw and obviously not call service (as hass is null)
      cameraSyncAction.callback(api);
    });

    it('should select option when entity state is undefined', () => {
      const hass = createHASS({});
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
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
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          camera: 'camera.two',
          view: 'live',
        }),
      );

      setRemoteControlEntityFromConfig(api);

      const cameraSyncAction = vi.mocked(api.getAutomationsManager().addAutomations).mock
        .calls[0][0][1].actions?.[0] as InternalCallbackActionConfig;
      expect(cameraSyncAction).toBeTruthy();
      expect(isAdvancedCameraCardCustomAction(cameraSyncAction)).toBeTruthy();
      expect(cameraSyncAction.advanced_camera_card_action).toBe(
        INTERNAL_CALLBACK_ACTION,
      );

      cameraSyncAction.callback(api);
      expect(hass.callService).toBeCalledWith(
        'input_select',
        'select_option',
        {
          option: 'camera.two',
        },
        {
          entity_id: 'input_select.camera',
        },
      );
    });

    it('should select option on initialization with card priority', () => {
      const hass = createHASS({
        'input_select.camera': createStateEntity({
          state: 'camera.one',
        }),
      });
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
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
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          camera: 'camera.two',
          view: 'live',
        }),
      );

      setRemoteControlEntityFromConfig(api);

      // Get the initialization callback (automation index 2)
      const initAction = vi.mocked(api.getAutomationsManager().addAutomations).mock
        .calls[0][0][2].actions?.[0] as InternalCallbackActionConfig;
      expect(initAction).toBeTruthy();
      expect(isAdvancedCameraCardCustomAction(initAction)).toBeTruthy();
      expect(initAction.advanced_camera_card_action).toBe(INTERNAL_CALLBACK_ACTION);

      initAction.callback(api);
      expect(hass.callService).toBeCalledWith(
        'input_select',
        'select_option',
        {
          option: 'camera.two',
        },
        {
          entity_id: 'input_select.camera',
        },
      );
    });
  });
});
