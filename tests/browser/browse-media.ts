import type { BrowseMedia } from '../../src/ha/browse-media/types';
import { createBrowseMedia } from '../test-utils';
import type { FakeHASS } from './fake-hass';

export const FRONT_DOOR_FOLDER_CONTENT_ID =
  'media-source://media_source/local/front-door';

export const createFrontDoorFolderMedia = (
  title: string,
  mediaClass: string,
): BrowseMedia =>
  createBrowseMedia({
    title,
    media_class: mediaClass,
    media_content_type: mediaClass,
    media_content_id: `${FRONT_DOOR_FOLDER_CONTENT_ID}/${title}`,
  });

/**
 * Register what browsing `FRONT_DOOR_FOLDER_CONTENT_ID` returns.
 */
export const registerFrontDoorFolder = (
  hass: FakeHASS,
  children: BrowseMedia[],
): void => {
  hass.registerBrowsableMedia(
    createBrowseMedia({
      title: 'front-door',
      media_class: 'directory',
      media_content_type: 'directory',
      media_content_id: FRONT_DOOR_FOLDER_CONTENT_ID,
      can_play: false,
      can_expand: true,
      children,
    }),
  );
};
