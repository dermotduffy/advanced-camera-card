import { fromUnixTime } from 'date-fns';
import type { MessageBase } from 'home-assistant-js-websocket';

import type { NativeFrigateEventQuery } from '../../src/camera-manager/frigate/requests';
import type { EventSummary, FrigateEvent } from '../../src/camera-manager/frigate/types';
import type { ResolvedMedia } from '../../src/ha/types';
import type { FakeHASS, WSCommandHandler } from './fake-hass';
import {
  CLIP_FIXTURE_FILENAME,
  createFixtureURL,
  SNAPSHOT_FIXTURE_FILENAME,
} from './fixtures';
import { CAMERA_ENTITY, type FakeCameraDescription } from './test-utils';

export const FRIGATE_CLIENT_ID = 'frigate';
export type FrigateMediaType = 'clips' | 'snapshots';
const FRIGATE_CONFIG_ENTRY_ID = 'frigate-config-entry';

/**
 * Frigate's name for a test camera, which this harness keeps equal to the
 * entity's object ID.
 */
export const getTestFrigateCameraName = (cameraEntity: string): string =>
  cameraEntity.split('.')[1];

/**
 * A camera belonging to Frigate.
 */
export const createFrigateCameraDescription = (
  entityID: string = CAMERA_ENTITY,
): FakeCameraDescription => ({
  entityID,
  entity: { state: 'idle', attributes: { client_id: FRIGATE_CLIENT_ID } },
  registry: {
    platform: 'frigate',
    unique_id: `${FRIGATE_CLIENT_ID}:camera:${getTestFrigateCameraName(entityID)}`,
    config_entry_id: FRIGATE_CONFIG_ENTRY_ID,
  },
});

// An event's media content ID, as `getEventMediaContentID` builds it:
// media-source://frigate/<client>/event/<clips|snapshots>/<camera>/<id>
const EVENT_CONTENT_ID =
  /^media-source:\/\/frigate\/(?<clientID>[^/]+)\/event\/(?<mediaType>[^/]+)\/(?<camera>[^/]+)\/(?<eventID>[^/]+)$/;

// An event's thumbnail, as `getEventThumbnailURL` asks for it:
// /api/frigate/<client>/thumbnail/<id>
const THUMBNAIL_PATH =
  /^\/api\/frigate\/(?<clientID>[^/]+)\/thumbnail\/(?<eventID>[^/]+)$/;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const isNumber = (value: unknown): value is number => typeof value === 'number';

// Read a request parameter, refusing a value of the wrong type.
const readParameter = <T>(
  message: MessageBase,
  name: string,
  isExpected: (value: unknown) => value is T,
  expected: string,
): T | undefined => {
  const value: unknown = message[name];
  if (value === undefined) {
    return undefined;
  }
  if (!isExpected(value)) {
    throw new Error(
      `FakeFrigate was sent a '${name}' that is not ${expected}: ` +
        JSON.stringify(value),
    );
  }
  return value;
};

const EVERY_REQUEST_PARAMETERS = ['type'];

// Refuse a request carrying a parameter this Frigate does not recognize.
const requireKnownParameters = (message: MessageBase, parameters: string[]): void => {
  const known = [...EVERY_REQUEST_PARAMETERS, ...parameters];
  const unknown = Object.keys(message).filter((name) => !known.includes(name));

  if (unknown.length) {
    throw new Error(`FakeFrigate was sent unknown parameters: ${unknown}`);
  }
};

// Frigate keeps every sub label an event has in one comma separated string.
const getSubLabels = (event: FrigateEvent): string[] =>
  event.sub_label?.split(',').map((subLabel) => subLabel.trim()) ?? [];

// The day an event falls on. Always UTC, the only time zone a `FakeHASS` reports,
// so `formatDate` cannot be used: it renders in local time.
const getEventDay = (event: FrigateEvent): string =>
  fromUnixTime(event.start_time).toISOString().slice(0, 'YYYY-MM-DD'.length);

interface FrigateMediaReference {
  clientID: string;
  mediaType: FrigateMediaType;
  camera: string;
  eventID: string;
}

// The event media a request is asking for, read out of its media content ID.
const parseContentID = (contentID: string): FrigateMediaReference | null => {
  const groups = EVENT_CONTENT_ID.exec(contentID)?.groups;
  if (!groups) {
    return null;
  }

  const mediaType = groups['mediaType'];
  if (mediaType !== 'clips' && mediaType !== 'snapshots') {
    return null;
  }

  return {
    clientID: groups['clientID'],
    mediaType,
    camera: groups['camera'],
    eventID: groups['eventID'],
  };
};

// The instance is separate from the actual query.
type EventQuery = Omit<NativeFrigateEventQuery, 'instance_id'>;

// Read the whole query before applying any of it. A request carrying nonsense is
// then refused even when no event would have matched anyway.
const readEventQuery = (message: MessageBase): EventQuery => {
  const getList = (name: string): string[] | undefined =>
    readParameter(message, name, isStringArray, 'a list of strings');
  const getBoolean = (name: string): boolean | undefined =>
    readParameter(message, name, isBoolean, 'true or false');
  const getCount = (name: string): number | undefined =>
    readParameter(message, name, isNumber, 'a number');

  return {
    cameras: getList('cameras'),
    labels: getList('labels'),
    sub_labels: getList('sub_labels'),
    zones: getList('zones'),
    after: getCount('after'),
    before: getCount('before'),
    favorites: getBoolean('favorites'),
    has_clip: getBoolean('has_clip'),
    has_snapshot: getBoolean('has_snapshot'),
    limit: getCount('limit'),
  };
};

// Whether an event is one the request asked for.
const matchesEventQuery = (event: FrigateEvent, query: EventQuery): boolean =>
  (!query.cameras || query.cameras.includes(event.camera)) &&
  (!query.labels || query.labels.includes(event.label)) &&
  (!query.sub_labels ||
    getSubLabels(event).some((subLabel) => query.sub_labels?.includes(subLabel))) &&
  (!query.zones || query.zones.some((zone) => event.zones.includes(zone))) &&
  // An event that began before the period and was still running when it started
  // counts as falling within it.
  (query.after === undefined || (event.end_time ?? Infinity) >= query.after) &&
  (query.before === undefined || event.start_time <= query.before) &&
  (!query.favorites || !!event.retain_indefinitely) &&
  (!query.has_clip || event.has_clip) &&
  (!query.has_snapshot || event.has_snapshot);

/**
 * A Frigate instance behind a `FakeHASS`. Holds the events a test wants a camera
 * to have recorded, and answers what the card asks about them.
 *
 * Any missing functionality returns an error.
 */
export class FakeFrigate {
  private _events: FrigateEvent[] = [];
  private _mediaURLs = new Map<string, string>();

  constructor(hass: FakeHASS) {
    hass.registerCommand(
      'frigate/events/get',
      this._answerAsFrigate(
        [
          'after',
          'before',
          'cameras',
          'favorites',
          'has_clip',
          'has_snapshot',
          'labels',
          'limit',
          'sub_labels',
          'zones',
        ],
        (message) => this._queryEvents(message),
      ),
    );
    hass.registerCommand(
      'frigate/events/summary',
      this._answerAsFrigate(['timezone'], () => this._summariseEvents()),
    );

    // Nothing here records. The media filter and the viewer's seek still ask, and
    // an unanswered request is an error.
    hass.registerCommand(
      'frigate/recordings/summary',
      this._answerAsFrigate(['camera', 'timezone'], () => []),
    );
    hass.registerCommand(
      'frigate/recordings/get',
      this._answerAsFrigate(['after', 'before', 'camera'], () => []),
    );
    hass.registerCommand(
      'frigate/ptz/info',
      this._answerAsFrigate(['camera'], () => ({})),
    );
    hass.registerPath(THUMBNAIL_PATH, (path) => this._serveThumbnail(path));

    hass.registerMediaSource(EVENT_CONTENT_ID, (contentID) =>
      this._resolveMedia(contentID),
    );
  }

  /**
   * The events this Frigate has recorded. Held newest first, as Frigate returns them.
   */
  public setEvents(events: FrigateEvent[]): void {
    this._events = [...events].sort((a, b) => b.start_time - a.start_time);
  }

  /**
   * Set the URL for a media item.
   */
  public setMediaURL(eventID: string, mediaType: FrigateMediaType, url: string): void {
    this._mediaURLs.set(this._getMediaKey(eventID, mediaType), url);
  }

  // Answer a command addressed to this instance, refusing one meant for
  // another. Frigate answers with JSON.
  private _answerAsFrigate(
    parameters: string[],
    handler: (message: MessageBase) => unknown,
  ): WSCommandHandler {
    return (message: MessageBase): string => {
      const instanceID: unknown = message['instance_id'];
      if (instanceID !== FRIGATE_CLIENT_ID) {
        throw new Error(
          `FakeFrigate was asked for another instance: ${String(instanceID)}`,
        );
      }
      requireKnownParameters(message, ['instance_id', ...parameters]);

      return JSON.stringify(handler(message));
    };
  }

  private _getMediaKey(eventID: string, mediaType: FrigateMediaType): string {
    return `${eventID}/${mediaType}`;
  }

  private _getEvent(eventID: string): FrigateEvent | null {
    return this._events.find((event) => event.id === eventID) ?? null;
  }

  private _queryEvents(message: MessageBase): FrigateEvent[] {
    const query = readEventQuery(message);
    const matching = this._events.filter((event) => matchesEventQuery(event, query));

    return query.limit === undefined ? matching : matching.slice(0, query.limit);
  }

  // What the media filter offers to filter by: every camera, day, label and zone
  // combination the events cover.
  private _summariseEvents(): EventSummary {
    const summaries = new Map<string, EventSummary[number]>();

    for (const event of this._events) {
      const summary = {
        camera: event.camera,
        day: getEventDay(event),
        label: event.label,
        sub_label: event.sub_label,
        zones: event.zones,
      };
      summaries.set(JSON.stringify(summary), summary);
    }

    return [...summaries.values()];
  }

  // Where an event's media is served from. The URL names the event, so a test can
  // tell which media is on screen without looking at the picture.
  private _resolveMedia(contentID: string): ResolvedMedia {
    const media = parseContentID(contentID);
    const event = media ? this._getEvent(media.eventID) : null;
    const isClip = media?.mediaType === 'clips';

    if (
      !media ||
      !event ||
      media.clientID !== FRIGATE_CLIENT_ID ||
      media.camera !== event.camera ||
      !(isClip ? event.has_clip : event.has_snapshot)
    ) {
      throw new Error(`FakeFrigate has no such media: ${contentID}`);
    }

    const filename = isClip ? CLIP_FIXTURE_FILENAME : SNAPSHOT_FIXTURE_FILENAME;

    return {
      url:
        this._mediaURLs.get(this._getMediaKey(media.eventID, media.mediaType)) ??
        `${createFixtureURL(filename)}?event=${media.eventID}`,
      mime_type: isClip ? 'video/webm' : 'image/png',
    };
  }

  private async _serveThumbnail(path: string): Promise<Response> {
    const groups = THUMBNAIL_PATH.exec(path)?.groups;

    if (
      !groups ||
      groups['clientID'] !== FRIGATE_CLIENT_ID ||
      !this._getEvent(groups['eventID'])
    ) {
      throw new Error(`FakeFrigate has no thumbnail at: ${path}`);
    }

    return await fetch(createFixtureURL(SNAPSHOT_FIXTURE_FILENAME));
  }
}
