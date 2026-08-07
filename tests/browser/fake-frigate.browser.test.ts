import { describe, expect, it } from 'vitest';

import type { FrigateEvent } from '../../src/camera-manager/frigate/types';
import type { ResolvedMedia } from '../../src/ha/types';
import { createFrigateEvent } from '../test-utils';
import {
  createFrigateCameraDescription,
  FakeFrigate,
  FRIGATE_CLIENT_ID,
  getTestFrigateCameraName,
  type FrigateMediaType,
} from './fake-frigate';
import type { FakeHASS } from './fake-hass';
import { CAMERA_ENTITY, createCameraHASS } from './test-utils';

const CAMERA_NAME = getTestFrigateCameraName(CAMERA_ENTITY);
const OTHER_CAMERA_NAME = 'hallway';

// Frigate timestamps are Unix seconds. Only their order matters here.
const EARLIER = 1000;
const LATER = 2000;

interface FrigateFixture {
  hass: FakeHASS;
  frigate: FakeFrigate;
}

const createFrigate = (events: FrigateEvent[]): FrigateFixture => {
  const hass = createCameraHASS([createFrigateCameraDescription()]);
  const frigate = new FakeFrigate(hass);
  frigate.setEvents(events);
  return { hass, frigate };
};

const createEvent = (id: string, event?: Partial<FrigateEvent>): FrigateEvent =>
  createFrigateEvent({
    camera: CAMERA_NAME,
    id,
    start_time: EARLIER,
    end_time: LATER,
    ...event,
  });

const queryEvents = async (
  hass: FakeHASS,
  parameters?: Record<string, unknown>,
): Promise<FrigateEvent[]> => {
  const answer = await hass.getHASS().callWS<string>({
    type: 'frigate/events/get',
    instance_id: FRIGATE_CLIENT_ID,
    ...parameters,
  });
  const events: FrigateEvent[] = JSON.parse(answer);
  return events;
};

const getEventIDs = async (
  hass: FakeHASS,
  parameters?: Record<string, unknown>,
): Promise<string[]> => (await queryEvents(hass, parameters)).map((event) => event.id);

const createContentID = (
  eventID: string,
  mediaType: FrigateMediaType,
  options?: { clientID?: string; camera?: string },
): string =>
  [
    'media-source://frigate',
    options?.clientID ?? FRIGATE_CLIENT_ID,
    'event',
    mediaType,
    options?.camera ?? CAMERA_NAME,
    eventID,
  ].join('/');

const resolveMedia = async (hass: FakeHASS, contentID: string): Promise<ResolvedMedia> =>
  await hass.getHASS().callWS<ResolvedMedia>({
    type: 'media_source/resolve_media',
    media_content_id: contentID,
  });

const createThumbnailPath = (eventID: string, clientID = FRIGATE_CLIENT_ID): string =>
  `/api/frigate/${clientID}/thumbnail/${eventID}`;

describe('FakeFrigate', () => {
  describe('requests', () => {
    it('should refuse a request meant for another instance', async () => {
      const { hass } = createFrigate([]);

      await expect(
        hass
          .getHASS()
          .callWS({ type: 'frigate/events/get', instance_id: 'other-frigate' }),
      ).rejects.toThrow('FakeFrigate was asked for another instance: other-frigate');

      await expect(
        hass
          .getHASS()
          .callWS({ type: 'frigate/ptz/info', instance_id: 'other-frigate' }),
      ).rejects.toThrow('FakeFrigate was asked for another instance: other-frigate');
    });

    it('should refuse a request carrying something it does not read', async () => {
      const { hass } = createFrigate([]);

      await expect(queryEvents(hass, { camera: CAMERA_NAME })).rejects.toThrow(
        'FakeFrigate was sent unknown parameters: camera',
      );
    });

    it('should refuse a parameter of the wrong type', async () => {
      const { hass } = createFrigate([]);

      await expect(queryEvents(hass, { cameras: CAMERA_NAME })).rejects.toThrow(
        `FakeFrigate was sent a 'cameras' that is not a list of strings: "${CAMERA_NAME}"`,
      );
      await expect(queryEvents(hass, { has_clip: 'yes' })).rejects.toThrow(
        `FakeFrigate was sent a 'has_clip' that is not true or false: "yes"`,
      );
    });
  });

  describe('events', () => {
    it('should return every event when nothing narrows the query', async () => {
      const { hass } = createFrigate([createEvent('one'), createEvent('two')]);

      expect(await getEventIDs(hass)).toEqual(['one', 'two']);
    });

    it('should return the newest event first', async () => {
      const { hass } = createFrigate([
        createEvent('older', { start_time: EARLIER }),
        createEvent('newer', { start_time: LATER }),
      ]);

      expect(await getEventIDs(hass)).toEqual(['newer', 'older']);
    });

    it('should return only the events for the cameras asked for', async () => {
      const { hass } = createFrigate([
        createEvent('here'),
        createEvent('elsewhere', { camera: OTHER_CAMERA_NAME }),
      ]);

      expect(await getEventIDs(hass, { cameras: [CAMERA_NAME] })).toEqual(['here']);
    });

    it('should return only the events holding the media asked for', async () => {
      const { hass } = createFrigate([
        createEvent('clip-only', { has_clip: true, has_snapshot: false }),
        createEvent('snapshot-only', { has_clip: false, has_snapshot: true }),
      ]);

      expect(await getEventIDs(hass, { has_clip: true })).toEqual(['clip-only']);
      expect(await getEventIDs(hass, { has_snapshot: true })).toEqual(['snapshot-only']);
    });

    it('should return only the events within the period asked for', async () => {
      const { hass } = createFrigate([
        createEvent('before', { start_time: 100, end_time: 200 }),
        createEvent('during', { start_time: 400, end_time: 600 }),
        createEvent('after', { start_time: 800, end_time: 900 }),
      ]);

      expect(await getEventIDs(hass, { after: 300, before: 700 })).toEqual(['during']);
    });

    it('should return an event that was still running when the period began', async () => {
      const { hass } = createFrigate([
        createEvent('running', { start_time: 100, end_time: 500 }),
      ]);

      expect(await getEventIDs(hass, { after: 300 })).toEqual(['running']);
    });

    it('should return only the events for the requested label', async () => {
      const { hass } = createFrigate([
        createEvent('person', { label: 'person' }),
        createEvent('car', { label: 'car' }),
      ]);

      expect(await getEventIDs(hass, { labels: ['car'] })).toEqual(['car']);
    });

    it('should return only the events in the requested zones', async () => {
      const { hass } = createFrigate([
        createEvent('driveway', { zones: ['driveway'] }),
        createEvent('garden', { zones: ['garden'] }),
      ]);

      expect(await getEventIDs(hass, { zones: ['garden'] })).toEqual(['garden']);
    });

    it('should return the events carrying any of the sub labels asked for', async () => {
      // Frigate keeps several sub labels on one event as a comma separated
      // string, so asking for one of them has to reach into it.
      const { hass } = createFrigate([
        createEvent('known', { sub_label: 'alice, bob' }),
        createEvent('stranger', { sub_label: null }),
      ]);

      expect(await getEventIDs(hass, { sub_labels: ['bob'] })).toEqual(['known']);
    });

    it('should return only the favorites', async () => {
      const { hass } = createFrigate([
        createEvent('kept', { retain_indefinitely: true }),
        createEvent('ordinary', { retain_indefinitely: false }),
      ]);

      expect(await getEventIDs(hass, { favorites: true })).toEqual(['kept']);
    });

    it('should return no more events than the limit asked for', async () => {
      const { hass } = createFrigate([
        createEvent('older', { start_time: EARLIER }),
        createEvent('newer', { start_time: LATER }),
      ]);

      expect(await getEventIDs(hass, { limit: 1 })).toEqual(['newer']);
    });
  });

  describe('media', () => {
    it('should resolve a clip to a video and a snapshot to an image', async () => {
      const { hass } = createFrigate([createEvent('one')]);

      expect(await resolveMedia(hass, createContentID('one', 'clips'))).toEqual({
        url: expect.stringContaining('clip.webm?event=one'),
        mime_type: 'video/webm',
      });
      expect(await resolveMedia(hass, createContentID('one', 'snapshots'))).toEqual({
        url: expect.stringContaining('still-red.png?event=one'),
        mime_type: 'image/png',
      });
    });

    it('should refuse media for an event it does not have', async () => {
      const { hass } = createFrigate([createEvent('one')]);

      await expect(resolveMedia(hass, createContentID('two', 'clips'))).rejects.toThrow(
        'FakeFrigate has no such media',
      );
    });

    it('should refuse media the event does not have', async () => {
      const { hass } = createFrigate([createEvent('one', { has_clip: false })]);

      await expect(resolveMedia(hass, createContentID('one', 'clips'))).rejects.toThrow(
        'FakeFrigate has no such media',
      );
    });

    it('should refuse media asked for under the wrong camera or instance', async () => {
      const { hass } = createFrigate([createEvent('one')]);

      await expect(
        resolveMedia(hass, createContentID('one', 'clips', { camera: 'elsewhere' })),
      ).rejects.toThrow('FakeFrigate has no such media');
      await expect(
        resolveMedia(hass, createContentID('one', 'clips', { clientID: 'other' })),
      ).rejects.toThrow('FakeFrigate has no such media');
    });

    it('should honor set media URL', async () => {
      const { hass, frigate } = createFrigate([createEvent('one')]);

      frigate.setMediaURL('one', 'clips', '/somewhere-else.webm');

      expect((await resolveMedia(hass, createContentID('one', 'clips'))).url).toBe(
        '/somewhere-else.webm',
      );

      // The snapshot is a separate media item and is left where it was.
      expect(
        (await resolveMedia(hass, createContentID('one', 'snapshots'))).url,
      ).toContain('still-red.png');
    });
  });

  describe('thumbnails', () => {
    it('should serve a picture for an event', async () => {
      const { hass } = createFrigate([createEvent('one')]);

      const response = await hass.getHASS().fetchWithAuth(createThumbnailPath('one'));

      expect(response.ok).toBe(true);
      expect(response.headers.get('Content-Type')).toContain('image/png');
    });

    it('should refuse a thumbnail for an event it does not have', async () => {
      const { hass } = createFrigate([createEvent('one')]);

      await expect(
        hass.getHASS().fetchWithAuth(createThumbnailPath('two')),
      ).rejects.toThrow('FakeFrigate has no thumbnail at');
    });
  });
});
