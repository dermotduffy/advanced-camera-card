import { z } from 'zod';
import { dayToDate } from '../../utils/basic';
import {
  Engine,
  EventQueryResults,
  RecordingQueryResults,
  RecordingSegmentsQueryResults,
} from '../types';

const dayStringToDate = (arg: unknown): Date | unknown => {
  return typeof arg === 'string' ? dayToDate(arg) : arg;
};

export const eventSchema = z.object({
  camera: z.string(),
  end_time: z.number().nullable(),
  false_positive: z.boolean().nullable(),
  has_clip: z.boolean(),
  has_snapshot: z.boolean(),
  id: z.string(),
  label: z.string(),
  sub_label: z.string().nullable(),
  start_time: z.number(),
  top_score: z.number().nullable(),
  zones: z.string().array(),
  retain_indefinitely: z.boolean().optional(),
});
export const frigateEventsSchema = eventSchema.array();

export type FrigateEvent = z.infer<typeof eventSchema>;

const recordingSummaryHourSchema = z.object({
  hour: z.preprocess((arg) => Number(arg), z.number().min(0).max(23)),
  duration: z.number().min(0),
  events: z.number().min(0),
});

export const recordingSummarySchema = z
  .object({
    day: z.preprocess(dayStringToDate, z.date()),
    events: z.number(),
    hours: recordingSummaryHourSchema.array(),
  })
  .array();
export type RecordingSummary = z.infer<typeof recordingSummarySchema>;

const recordingSegmentSchema = z.object({
  start_time: z.number(),
  end_time: z.number(),
  id: z.string(),
});
export const recordingSegmentsSchema = recordingSegmentSchema.array();

export const retainResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type RetainResult = z.infer<typeof retainResultSchema>;

export interface FrigateRecording {
  cameraID: string;
  startTime: Date;
  endTime: Date;
  events: number;
}

export const eventSummarySchema = z
  .object({
    camera: z.string(),
    // Days in RFC3339 format.
    day: z.string(),
    label: z.string(),
    sub_label: z.string().nullable(),
    zones: z.string().array(),
  })
  .array();
export type EventSummary = z.infer<typeof eventSummarySchema>;

export const ptzInfoSchema = z.object({
  name: z.string().optional(),
  features: z.string().array().optional(),
  presets: z.string().array().optional(),
});
export type PTZInfo = z.infer<typeof ptzInfoSchema>;

const frigateEventChangeBeforeAfterSchema = z.object({
  camera: z.string(),
  id: z.string(),
  snapshot: z
    .object({
      frame_time: z.number(),
    })
    .nullable(),
  has_clip: z.boolean(),
  has_snapshot: z.boolean(),
  label: z.string(),
  current_zones: z.string().array(),
});

export const frigateEventChangeSchema = z.object({
  before: frigateEventChangeBeforeAfterSchema,
  after: frigateEventChangeBeforeAfterSchema,
  type: z.enum(['new', 'update', 'end']),
});
export type FrigateEventChange = z.infer<typeof frigateEventChangeSchema>;

// ==============================
// Frigate concrete query results
// ==============================

export interface FrigateEventQueryResults extends EventQueryResults {
  engine: Engine.Frigate;
  instanceID: string;
  events: FrigateEvent[];
}

export interface FrigateRecordingQueryResults extends RecordingQueryResults {
  engine: Engine.Frigate;
  instanceID: string;
  recordings: FrigateRecording[];
}

export interface FrigateRecordingSegmentsQueryResults
  extends RecordingSegmentsQueryResults {
  engine: Engine.Frigate;
  instanceID: string;
}
