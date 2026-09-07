import { describe, expect, it } from 'vitest';

import type { RawAdvancedCameraCardConfig } from '../../src/config/types';
import {
  createFrontDoorFolderMedia,
  FRONT_DOOR_FOLDER_CONTENT_ID,
  registerFrontDoorFolder,
} from '../browser/browse-media';
import { deepQuery } from '../browser/dom';
import {
  createFrigateCameraDescription,
  createTestFrigateEvent,
  EVENT_TIME_NEWER,
  mountCardWithFrigate,
} from '../browser/fake-frigate';
import { CLIP_FIXTURE_FILENAME, createFixtureURL } from '../browser/fixtures';
import { MountedCardFactory } from '../browser/mounted-card';
import {
  clickThumbnail,
  createCameraHASS,
  createGenericCameraHASS,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  waitForThumbnails,
} from '../browser/test-utils';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

// The color a test configures, in the form `getComputedStyle` reports it back.
const CONFIGURED_BACKGROUND = 'rgb(0, 128, 0)';

const getIcon = (button: HTMLElement): Element | null =>
  deepQuery(button, 'advanced-camera-card-icon');

describe('AdvancedCameraCardMenu', () => {
  it('should apply a configured style to the button', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        menu: {
          style: 'outside',
          buttons: { live: { style: { background: CONFIGURED_BACKGROUND } } },
        },
      }),
      createGenericCameraHASS(),
    );

    const button = await card.findControl('Live view');

    const icon = getIcon(button);

    expect(getComputedStyle(button).backgroundColor).toBe(CONFIGURED_BACKGROUND);
    expect(icon).not.toBeNull();
    expect(icon && getComputedStyle(icon).backgroundColor).toBe(TRANSPARENT);
  });

  it('should apply a configured style to a submenu button', async () => {
    const secondCamera = 'camera.kitchen';
    const config: RawAdvancedCameraCardConfig = {
      ...createStillImageCardConfig({
        menu: {
          style: 'outside',
          buttons: { cameras: { style: { background: CONFIGURED_BACKGROUND } } },
        },
      }),
      cameras: [
        createStillImageCameraConfig(),
        createStillImageCameraConfig(secondCamera),
      ],
    };

    const card = await MountedCardFactory.createFromSource(
      config,
      createGenericCameraHASS({ cameras: [secondCamera] }),
    );

    const button = await card.findControl('Cameras');
    const icon = getIcon(button);

    expect(getComputedStyle(button).backgroundColor).toBe(CONFIGURED_BACKGROUND);
    expect(icon).not.toBeNull();
    expect(icon && getComputedStyle(icon).backgroundColor).toBe(TRANSPARENT);
  });

  describe('download button', () => {
    it('should have a download button for camera media', async () => {
      const { card } = await mountCardWithFrigate(
        [createTestFrigateEvent('newer', EVENT_TIME_NEWER)],
        { menu: { style: 'outside' }, view: { default: 'clips' } },
      );

      await waitForThumbnails(card, 1);
      await clickThumbnail(card.card, 0);

      expect(await card.findControl('Download')).not.toBeNull();
    });

    it('should have a download button for folder media', async () => {
      const hass = createCameraHASS([createFrigateCameraDescription()]);
      registerFrontDoorFolder(hass, [createFrontDoorFolderMedia('clip.mp4', 'video')]);
      hass.registerMediaSource(/clip\.mp4$/, async () => ({
        url: createFixtureURL(CLIP_FIXTURE_FILENAME),
        mime_type: 'video/webm',
      }));

      const card = await MountedCardFactory.createFromSource(
        createStillImageCardConfig({
          menu: { style: 'outside' },
          view: { default: 'folders' },
          folders: [
            { type: 'ha', ha: { path: [{ id: FRONT_DOOR_FOLDER_CONTENT_ID }] } },
          ],
        }),
        hass,
      );

      // Two thumbnails: 'Up' + media.
      await waitForThumbnails(card, 2);
      await clickThumbnail(card.card, 1);

      expect(await card.findControl('Download')).not.toBeNull();
    });
  });
});
