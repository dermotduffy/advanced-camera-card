import { getEntityTitle } from '../../ha/get-entity-title';
import type { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { isRecord, prettifyTitle } from '../../utils/basic';

/**
 * Get an editor title for a camera, starting with the most likely to be
 * useful attribute and working towards the least useful. The camera manager
 * cannot provide a title here as it cannot start with an unparsed and
 * unloaded configuration.
 * @param index The index of the camera in the cameras array.
 * @param cameraConfig The raw camera configuration.
 * @param hass The HomeAssistant object.
 * @returns A string title.
 */
export const getEditorCameraTitle = (
  index: number,
  cameraConfig: unknown,
  hass?: HomeAssistant,
): string => {
  const config = isRecord(cameraConfig) ? cameraConfig : {};
  const webrtcCardEntity = isRecord(config.webrtc_card)
    ? config.webrtc_card.entity
    : null;
  const frigateCameraName = isRecord(config.frigate) ? config.frigate.camera_name : null;
  return (
    (typeof config.title === 'string' && config.title) ||
    (typeof config.camera_entity === 'string'
      ? getEntityTitle(hass, config.camera_entity)
      : '') ||
    (typeof webrtcCardEntity === 'string' && webrtcCardEntity) ||
    (typeof frigateCameraName === 'string' && frigateCameraName
      ? prettifyTitle(frigateCameraName)
      : '') ||
    (typeof config.id === 'string' && config.id) ||
    localize('editor.camera') + ' #' + index
  );
};

/**
 * Get an editor title for a folder.
 * @param index The index of the folder in the folders array.
 * @param folderConfig The raw folder configuration.
 * @returns A string title.
 */
export const getEditorFolderTitle = (index: number, folderConfig: unknown): string => {
  const config = isRecord(folderConfig) ? folderConfig : {};
  return (
    (typeof config.title === 'string' && config.title) ||
    (typeof config.id === 'string' && config.id) ||
    localize('common.folder') + ' #' + index
  );
};

/**
 * Get an editor title for a camera trigger event.
 * @param index The index of the event in the events array.
 * @param eventConfig The raw event configuration.
 * @returns A string title.
 */
export const getEditorTriggerEventTitle = (
  index: number,
  eventConfig: unknown,
): string => {
  const config = isRecord(eventConfig) ? eventConfig : {};
  return (
    (typeof config.event_type === 'string' && config.event_type) ||
    localize('common.event') + ' #' + index
  );
};
