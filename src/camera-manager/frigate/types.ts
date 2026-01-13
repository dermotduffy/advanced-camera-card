import { z } from 'zod';
import { dayToDate } from '../../utils/basic';
import {
  Engine,
  EventQueryResults,
  RecordingQueryResults,
  RecordingSegmentsQueryResults,
  ReviewQueryResults,
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
  data: z
    .object({
      // GenAI-generated text description of the object/event
      description: z.string().optional(),
    })
    .optional(),
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

export const reviewResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type ReviewResult = z.infer<typeof reviewResultSchema>;

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

// =============
// Review Types
// =============

// Maps card severity to Frigate severity
export const FRIGATE_SEVERITY_MAP = {
  high: 'alert',
  medium: 'detection',
  low: 'significant_motion',
} as const;

export type FrigateReviewSeverity =
  (typeof FRIGATE_SEVERITY_MAP)[keyof typeof FRIGATE_SEVERITY_MAP];

// Review data schema (only fields we need for display)
const frigateReviewDataSchema = z.object({
  objects: z.string().array().optional(),
  zones: z.string().array().optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      scene: z.string().optional(),
      shortSummary: z.string().optional(),
    })
    .nullable()
    .optional(),
});

// Review item schema
const frigateReviewSchema = z.object({
  id: z.string(),
  camera: z.string(),
  severity: z.enum(['alert', 'detection', 'significant_motion']),
  start_time: z.number(),
  end_time: z.number().nullable(),
  thumb_path: z.string().nullable(),
  has_been_reviewed: z.boolean().optional(),
  data: frigateReviewDataSchema,
});
export const frigateReviewsSchema = frigateReviewSchema.array();

export type FrigateReview = z.infer<typeof frigateReviewSchema>;

// Review change schema for live WebSocket updates
export const frigateReviewChangeSchema = z.object({
  before: frigateReviewSchema,
  after: frigateReviewSchema,
  type: z.enum(['new', 'update', 'end', 'genai']),
});
export type FrigateReviewChange = z.infer<typeof frigateReviewChangeSchema>;

export interface FrigateReviewQueryResults extends ReviewQueryResults {
  engine: Engine.Frigate;
  instanceID: string;
  reviews: FrigateReview[];
}
