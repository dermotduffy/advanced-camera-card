import { describe, expect, it } from 'vitest';

import { getHassDifferences } from '../../src/ha/get-hass-differences';
import { FakeHASS } from './fake-hass';

const CAMERA = 'camera.office';
const SWITCH = 'input_boolean.zoom';

const createFakeHASS = (): FakeHASS =>
  new FakeHASS({
    entities: { [CAMERA]: { state: 'idle' }, [SWITCH]: { state: 'off' } },
    registry: { [CAMERA]: { device_id: 'device-1' } },
  });

// @vitest-environment jsdom
describe('FakeHASS', () => {
  describe('identity', () => {
    it('should hand out a new object every time it is renewed', () => {
      const hass = createFakeHASS();
      const before = hass.getHASS();

      hass.renew();

      expect(hass.getHASS()).not.toBe(before);

      // The states map itself is only rebuilt when a state changed, as Home
      // Assistant rebuilds it. A renewal carrying no state change hands back the
      // same map, so a card gating on the map's identity sees the truth.
      expect(hass.getHASS().states).toBe(before.states);
    });

    it('should hand out a new states map when a state changed', () => {
      const hass = createFakeHASS();
      const before = hass.getHASS();

      hass.setState(SWITCH, 'on');

      expect(hass.getHASS().states).not.toBe(before.states);
    });

    it('should replace the state object only for the entity that changed', () => {
      const hass = createFakeHASS();
      const before = hass.getHASS();

      hass.setState(SWITCH, 'on');
      const after = hass.getHASS();

      expect(after.states[SWITCH]).not.toBe(before.states[SWITCH]);
      expect(after.states[CAMERA]).toBe(before.states[CAMERA]);
    });

    // Updating immutably is what lets any Home Assistant consumer identify the
    // entities that changed by comparing references. `getHassDifferences` is
    // borrowed here as a ready-made reference comparison over a named set of
    // entities: the instrument, not the thing being specified.
    it('should report exactly the entities that changed under a reference comparison', () => {
      const hass = createFakeHASS();
      const before = hass.getHASS();

      hass.setState(SWITCH, 'on');

      expect(
        getHassDifferences(hass.getHASS(), before, [CAMERA, SWITCH]).map(
          (difference) => difference.entityID,
        ),
      ).toEqual([SWITCH]);
    });

    it('should report no differences when nothing changed', () => {
      const hass = createFakeHASS();
      const before = hass.getHASS();

      hass.renew();

      expect(getHassDifferences(hass.getHASS(), before, [CAMERA, SWITCH])).toEqual([]);
    });

    it('should report a removed entity as a difference', () => {
      const hass = createFakeHASS();
      const before = hass.getHASS();

      hass.removeState(SWITCH);

      expect(hass.getHASS().states[SWITCH]).toBeUndefined();
      expect(
        getHassDifferences(hass.getHASS(), before, [SWITCH]).map(
          (difference) => difference.entityID,
        ),
      ).toEqual([SWITCH]);
    });
  });

  describe('websocket commands', () => {
    it('should answer a registered command', async () => {
      const hass = createFakeHASS();

      await expect(
        hass.getHASS().callWS({ type: 'config/entity_registry/get', entity_id: CAMERA }),
      ).resolves.toEqual(expect.objectContaining({ entity_id: CAMERA }));
    });

    it('should reject an unregistered command', async () => {
      const hass = createFakeHASS();

      await expect(
        hass.getHASS().callWS({ type: 'camera/stream', entity_id: CAMERA }),
      ).rejects.toThrow('FakeHASS received an unregistered WS command: camera/stream');
    });

    it('should let a test replace a command handler', async () => {
      const hass = createFakeHASS();
      hass.registerCommand('camera/stream', () => ({ url: '/stream.m3u8' }));

      await expect(
        hass.getHASS().callWS({ type: 'camera/stream', entity_id: CAMERA }),
      ).resolves.toEqual({ url: '/stream.m3u8' });
    });

    it('should answer a command sent through the connection from the same table', async () => {
      const hass = createFakeHASS();
      hass.registerCommand('camera/stream', () => ({ url: '/stream.m3u8' }));

      await expect(
        hass.getHASS().connection.sendMessagePromise({ type: 'camera/stream' }),
      ).resolves.toEqual({ url: '/stream.m3u8' });
    });

    it('should reject an unregistered command sent through the connection', async () => {
      const hass = createFakeHASS();

      await expect(
        hass.getHASS().connection.sendMessagePromise({ type: 'camera/stream' }),
      ).rejects.toThrow('FakeHASS received an unregistered WS command: camera/stream');
    });

    it('should record every command in order', async () => {
      const hass = createFakeHASS();

      await hass.getHASS().callWS({ type: 'lovelace/resources' });
      await hass
        .getHASS()
        .callWS({ type: 'config/entity_registry/get', entity_id: CAMERA });

      expect(hass.getCommandLog().map((message) => message.type)).toEqual([
        'lovelace/resources',
        'config/entity_registry/get',
      ]);
    });
  });

  describe('authenticated fetches', () => {
    it('should answer a registered path', async () => {
      const hass = createFakeHASS();
      hass.registerPath(/^\/api\/thumbnail\/.+$/, (path) => new Response(path));

      const response = await hass.getHASS().fetchWithAuth('/api/thumbnail/1');

      await expect(response.text()).resolves.toBe('/api/thumbnail/1');
    });

    it('should reject an unregistered path', async () => {
      const hass = createFakeHASS();

      await expect(hass.getHASS().fetchWithAuth('/api/thumbnail/1')).rejects.toThrow(
        'FakeHASS received a request for an unregistered path: /api/thumbnail/1',
      );
    });
  });

  describe('media sources', () => {
    const resolveMedia = async (hass: FakeHASS, contentID: unknown): Promise<unknown> =>
      await hass
        .getHASS()
        .callWS({ type: 'media_source/resolve_media', media_content_id: contentID });

    it('should resolve a content ID with the source that claims it', async () => {
      const hass = createFakeHASS();
      hass.registerMediaSource(/^media-source:\/\/other\//, () => ({
        url: '/other.mp4',
        mime_type: 'video/mp4',
      }));
      hass.registerMediaSource(/^media-source:\/\/mine\//, (contentID) => ({
        url: `/mine.mp4?id=${contentID}`,
        mime_type: 'video/mp4',
      }));

      // Demonstrate that two sources coexist.
      expect(await resolveMedia(hass, 'media-source://mine/1')).toEqual({
        url: '/mine.mp4?id=media-source://mine/1',
        mime_type: 'video/mp4',
      });
      expect(await resolveMedia(hass, 'media-source://other/1')).toEqual({
        url: '/other.mp4',
        mime_type: 'video/mp4',
      });
    });

    it('should reject a content ID no source claims', async () => {
      const hass = createFakeHASS();

      await expect(resolveMedia(hass, 'media-source://mine/1')).rejects.toThrow(
        'FakeHASS has no media source for: media-source://mine/1',
      );
    });

    it('should reject a request carrying no content ID', async () => {
      const hass = createFakeHASS();

      await expect(resolveMedia(hass, undefined)).rejects.toThrow(
        'FakeHASS was asked to resolve media without a content ID',
      );
    });
  });

  describe('unimplemented methods', () => {
    it('should throw rather than quietly do nothing', () => {
      const hass = createFakeHASS().getHASS();

      expect(() => hass.callService('camera', 'turn_on')).toThrow(
        'FakeHASS does not implement callService',
      );
      expect(() => hass.sendWS({ type: 'ping' })).toThrow(
        'FakeHASS does not implement sendWS',
      );
    });
  });
});
