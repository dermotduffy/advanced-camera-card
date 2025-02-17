import {
  createCameraAction,
  createInternalCallbackAction,
  createPerformAction,
} from '../../utils/action';
import { CardActionsAPI, CardConfigLoaderAPI, TaggedAutomation } from '../types';

export const setRemoteControlEntityFromConfig = (api: CardConfigLoaderAPI) => {
  const automationTag = setRemoteControlEntityFromConfig;

  api.getAutomationsManager().deleteAutomations(automationTag);

  const cameraControlEntity = api.getConfigManager().getConfig()?.remote_control
    ?.entities?.camera;
  if (!cameraControlEntity) {
    return;
  }

  const createSelectOptionAction = (option: string) =>
    createPerformAction('input_select.select_option', {
      target: {
        entity_id: cameraControlEntity,
      },
      data: {
        option: option,
      },
    });

  // Control entities functionality is implemented entirely by populating
  // automations.

  const automations: TaggedAutomation[] = [
    {
      conditions: [
        {
          condition: 'config' as const,
          paths: ['remote_control.entities.camera'],
        },
      ],
      actions: [
        // Set the possible options on the entity to the camera IDs via a
        // callback to `setCameraOptionsOnEntity` (below).
        createInternalCallbackAction((api: CardActionsAPI) =>
          setCameraOptionsOnEntity(cameraControlEntity, api),
        ),
        // Set the selected option to the current camera ID.
        createSelectOptionAction('{{ advanced_camera_card.camera }}'),
      ],
      tag: automationTag,
    },
    {
      conditions: [
        {
          condition: 'camera' as const,
        },
      ],
      actions: [
        // When the camera changes, update the entity to match.
        createSelectOptionAction('{{ advanced_camera_card.trigger.camera.to }}'),
      ],
      tag: automationTag,
    },
    {
      conditions: [
        {
          condition: 'state' as const,
          entity: cameraControlEntity,
        },
      ],
      actions: [
        // When the entity state changes, updated the selected option.
        createCameraAction(
          'camera_select',
          '{{ advanced_camera_card.trigger.state.to }}',
        ),
      ],
      tag: automationTag,
    },
  ];

  api.getAutomationsManager().addAutomations(automations);
};

const setCameraOptionsOnEntity = async (entity: string, api: CardActionsAPI) => {
  const hass = api.getHASSManager().getHASS();
  const cameraIDs = api.getCameraManager().getStore().getCameraIDs();

  await hass?.callService(
    'input_select',
    'set_options',
    {
      options: [...cameraIDs],
    },
    {
      entity_id: entity,
    },
  );
};
