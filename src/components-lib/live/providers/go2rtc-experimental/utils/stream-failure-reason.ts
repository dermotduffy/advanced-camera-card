import type { MediaUnavailableIssueReason } from '../../../../../card-controller/issues/issues/media-unavailable';
import type { StreamSourceFailureReason } from '../types';

// The card's media-unavailable causes are user-facing; a source's failure
// reasons are technical. Only a media error and a buffer overflow have no
// distinct user story, so they map to a generic playback error; the rest each
// keep a meaningful cause -- a server rejection, an unsupported stream, or a
// timeout that means the stream never got going.
const STREAM_FAILURE_TO_ISSUE_REASON: Record<
  StreamSourceFailureReason,
  MediaUnavailableIssueReason
> = {
  buffer_overflow: 'playback_error',
  connect_timeout: 'not_loading',
  media_error: 'playback_error',
  negotiation_timeout: 'not_loading',
  server_error: 'server_error',
  unsupported: 'unsupported',
};

// A null reason is a connection-level failure with no source detail (e.g. the
// socket dropped), which reads as a generic playback error.
export const mapStreamFailureReasonToIssueReason = (
  reason: StreamSourceFailureReason | null,
): MediaUnavailableIssueReason =>
  reason === null ? 'playback_error' : STREAM_FAILURE_TO_ISSUE_REASON[reason];
