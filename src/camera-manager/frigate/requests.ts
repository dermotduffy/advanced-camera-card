import { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import { AdvancedCameraCardError } from '../../types';
import { homeAssistantWSRequest } from '../../utils/ha/ws-request';
import { RecordingSegment } from '../types';
import {
  EventSummary,
  eventSummarySchema,
  FrigateEvent,
  frigateEventsSchema,
  PTZInfo,
  ptzInfoSchema,
  recordingSegmentsSchema,
  RecordingSummary,
  recordingSummarySchema,
  RetainResult,
  retainResultSchema,
} from './types';

/**
 * Get the recordings summary. May throw.
 * @param hass The Home Assistant object.
 * @param clientID The Frigate clientID.
 * @param camera_name The Frigate camera name.
 * @returns A RecordingSummary object.
 */
export const getRecordingsSummary = async (
  hass: HomeAssistant,
  clientID: string,
  camera_name: string,
): Promise<RecordingSummary> => {
  return (await homeAssistantWSRequest(
    hass,
    recordingSummarySchema,
    {
      type: 'frigate/recordings/summary',
      instance_id: clientID,
      camera: camera_name,

      // Ask for the summary relative to HA timezone
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/1267
      timezone: hass.config.time_zone,
    },
    true,
    // See: https://github.com/colinhacks/zod/pull/1752
  )) as RecordingSummary;
};

export interface NativeFrigateRecordingSegmentsQuery {
  instance_id: string;
  camera: string;
  after: number;
  before: number;
}

/**
 * Get the recording segments. May throw.
 * @param hass The Home Assistant object.
 * @param params The recording segment query parameters.
 * @returns A RecordingSegments object.
 */
export const getRecordingSegments = async (
  hass: HomeAssistant,
  params: NativeFrigateRecordingSegmentsQuery,
): Promise<RecordingSegment[]> => {
  return await homeAssistantWSRequest(
    hass,
    recordingSegmentsSchema,
    {
      type: 'frigate/recordings/get',
      ...params,
    },
    true,
  );
};

/**
 * Request that Frigate retain an event. May throw.
 * @param hass The HomeAssistant object.
 * @param clientID The Frigate clientID.
 * @param eventID The event ID to retain.
 * @param retain `true` to retain or `false` to unretain.
 */
export async function retainEvent(
  hass: HomeAssistant,
  clientID: string,
  eventID: string,
  retain: boolean,
): Promise<void> {
  const retainRequest = {
    type: 'frigate/event/retain',
    instance_id: clientID,
    event_id: eventID,
    retain: retain,
  };
  const response = await homeAssistantWSRequest<RetainResult>(
    hass,
    retainResultSchema,
    retainRequest,
    true,
  );
  if (!response.success) {
    throw new AdvancedCameraCardError(localize('error.failed_retain'), {
      request: retainRequest,
      response: response,
    });
  }
}

export interface NativeFrigateEventQuery {
  instance_id?: string;
  cameras?: string[];
  labels?: string[];
  zones?: string[];
  after?: number;
  before?: number;
  limit?: number;
  has_clip?: boolean;
  has_snapshot?: boolean;
  favorites?: boolean;
}

/**
 * Get events over websocket. May throw.
 * @param hass The Home Assistant object.
 * @param params The events search parameters.
 * @returns An array of 'FrigateEvent's.
 */
export const getEvents = async (
  hass: HomeAssistant,
  params?: NativeFrigateEventQuery,
): Promise<FrigateEvent[]> => {
  return await homeAssistantWSRequest(
    hass,
    frigateEventsSchema,
    {
      type: 'frigate/events/get',
      ...params,
    },
    true,
  );
};

export const getEventSummary = async (
  hass: HomeAssistant,
  clientID: string,
): Promise<EventSummary> => {
  return await homeAssistantWSRequest(
    hass,
    eventSummarySchema,
    {
      type: 'frigate/events/summary',
      instance_id: clientID,

      // Ask for the summary relative to HA timezone
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/1267
      timezone: hass.config.time_zone,
    },
    true,
  );
};

export const getPTZInfo = async (
  hass: HomeAssistant,
  clientID: string,
  cameraName: string,
): Promise<PTZInfo> => {
  return await homeAssistantWSRequest(
    hass,
    ptzInfoSchema,
    {
      type: 'frigate/ptz/info',
      instance_id: clientID,
      camera: cameraName,
    },
    true,
  );
};
