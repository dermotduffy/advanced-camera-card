import { isEqual } from 'lodash-es';
import { RemoteControlEntityPriority } from '../../config/schema/remote-control';
import { createCameraAction, createInternalCallbackAction } from '../../utils/action';
import { CardActionsAPI, CardConfigLoaderAPI, TaggedAutomation } from '../types';

export const setRemoteControlEntityFromConfig = (api: CardConfigLoaderAPI) => {
  const automationTag = setRemoteControlEntityFromConfig;

  api.getAutomationsManager().deleteAutomations(automationTag);

  const remoteControlConfig = api.getConfigManager().getConfig()?.remote_control;
  const cameraControlEntity = remoteControlConfig?.entities.camera;
  if (!cameraControlEntity) {
    return;
  }

  const cameraPriority: RemoteControlEntityPriority =
    remoteControlConfig.entities.camera_priority;

  // Control entities functionality is implemented entirely by populating
  // automations.

  const automations: TaggedAutomation[] = [
    {
      conditions: [
        {
          condition: 'config' as const,
          paths: ['cameras', 'remote_control.entities.camera'],
        },
      ],
      actions: [
        // Set the possible options on the entity to the camera IDs via a
        // callback to `setCameraOptionsOnEntity` (below).
        createInternalCallbackAction((api: CardActionsAPI) =>
          setCameraOptionsOnEntity(cameraControlEntity, api),
        ),
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
        // When the camera changes, update the entity to match (only if different
        // to avoid race conditions when multiple cards share the same entity).
        // See: https://github.com/dermotduffy/advanced-camera-card/issues/2244
        createInternalCallbackAction(async (api: CardActionsAPI) =>
          selectOptionOnEntityIfDifferent(
            api,
            cameraControlEntity,
            api.getViewManager().getView()?.camera ?? undefined,
          ),
        ),
      ],
      tag: automationTag,
    },
    {
      // Immediately on the start, the HA state for the entity will be updated.
      // However, that will almost certainly not trigger the condition below
      // this one, as automations only run *after* the card is initialized (and
      // it very likely will not yet be). Instead, wait to be initialized, then
      // set the camera.
      conditions: [
        {
          condition: 'initialized' as const,
        },
      ],
      actions: [
        cameraPriority === 'entity'
          ? // Set the currently selected camera to the state of the entity.
            createCameraAction(
              'camera_select',
              `{{ hass.states["${cameraControlEntity}"].state }}`,
            )
          : // Set the selected option in the entity to the current camera ID.
            createInternalCallbackAction(async (api: CardActionsAPI) => {
              const camera = api.getViewManager().getView()?.camera ?? undefined;
              return selectOptionOnEntityIfDifferent(api, cameraControlEntity, camera);
            }),
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

const selectOptionOnEntityIfDifferent = async (
  api: CardActionsAPI,
  entity: string,
  option?: string,
): Promise<void> => {
  const hass = api.getHASSManager().getHASS();
  const currentState = hass?.states[entity]?.state;

  // Only update if the option is defined and different from current state.
  // This prevents race conditions when multiple cards share the same entity.
  // See: https://github.com/dermotduffy/advanced-camera-card/issues/2244
  if (!option || option === currentState) {
    return;
  }

  await hass?.callService(
    'input_select',
    'select_option',
    {
      option: option,
    },
    {
      entity_id: entity,
    },
  );
};

const setCameraOptionsOnEntity = async (entity: string, api: CardActionsAPI) => {
  const hass = api.getHASSManager().getHASS();
  const cameraIDs = api.getCameraManager().getStore().getCameraIDs();

  const existingOptions = (hass?.states[entity]?.attributes?.options ?? []).sort();
  const desiredOptions = [...cameraIDs].sort();

  if (isEqual(existingOptions, desiredOptions)) {
    return;
  }

  await hass?.callService(
    'input_select',
    'set_options',
    {
      options: desiredOptions,
    },
    {
      entity_id: entity,
    },
  );
};
