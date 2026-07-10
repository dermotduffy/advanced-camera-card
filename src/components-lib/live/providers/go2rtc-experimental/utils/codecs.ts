import { getSafariMajorVersion } from './user-agent';

// Codec strings offered to the go2rtc server when negotiating an MSE or MP4
// stream. The go2rtc server recognizes only a fixed set of exact strings (one
// canonical spelling per codec, e.g. `avc1.640029` for all H.264) and silently
// ignores the rest; it then matches the camera's tracks by codec name alone,
// never comparing profile or level.
//
// So membership here is not correctness-critical: an unrecognized entry (a
// different H.264 level, AAC-HE) has no effect, and a camera streaming any
// level still matches. The list can stay a broad superset rather than tracking
// one server version's exact set.
//
// Order matters as the offer's preference order: video before audio, and audio
// most to least reliably supported.
//
// H.264/H.265 video, most-compatible first. Offered to every browser.
const GO2RTC_VIDEO_CODECS: readonly string[] = [
  // H.264 high 4.1
  'avc1.640029',

  // H.264 high 4.2
  'avc1.64002A',

  // H.264 high 5.1
  'avc1.640033',

  // H.265 main 5.1
  'hvc1.1.6.L153.B0',
];

// Audio is layered by the oldest Safari major version that can decode each
// codec via MSE (see `getCodecsForUserAgent`). Each tier extends the previous
// one with the next-most-reliable audio codec.
const GO2RTC_SAFARI_13_CODECS: readonly string[] = [
  ...GO2RTC_VIDEO_CODECS,
  // AAC LC
  'mp4a.40.2',

  // AAC HE
  'mp4a.40.5',
];

const GO2RTC_SAFARI_14_CODECS: readonly string[] = [
  ...GO2RTC_SAFARI_13_CODECS,

  // FLAC
  'flac',
];

// Full codec set: offered to non-Safari browsers.
export const GO2RTC_CODECS: readonly string[] = [
  ...GO2RTC_SAFARI_14_CODECS,

  // Opus
  'opus',
];

// Safari's `isTypeSupported` over-reports audio codec support, so offer only
// the codec set the running major version can *actually* play via MSE. The
// version boundaries (AAC from 13, FLAC from 14, OPUS never) are empirical
// browser-compatibility observations, not derived values -- treat them as a
// best-known table that may need revising for future Safari versions.
export const getCodecsForUserAgent = (userAgent: string): readonly string[] => {
  const version = getSafariMajorVersion(userAgent);
  if (version === null) {
    return GO2RTC_CODECS;
  }
  if (version < 13) {
    return GO2RTC_VIDEO_CODECS;
  }
  if (version < 14) {
    return GO2RTC_SAFARI_13_CODECS;
  }
  return GO2RTC_SAFARI_14_CODECS;
};

interface CodecMediaSelection {
  audio: boolean;
  video: boolean;
}

// A codec is a video codec if it contains 'vc1' beyond position zero (avc1.*,
// hvc1.*); everything else in the go2rtc codec list is audio.
const isVideoCodec = (codec: string): boolean => codec.indexOf('vc1') > 0;

// Filter the codec list to the requested media kinds and to what the given
// support callback accepts.
export const selectSupportedCodecs = (
  codecs: readonly string[],
  media: CodecMediaSelection,
  isSupported: (mimeType: string) => boolean,
): readonly string[] =>
  codecs
    .filter((codec) => (isVideoCodec(codec) ? media.video : media.audio))
    .filter((codec) => isSupported(`video/mp4; codecs="${codec}"`));

// Encode a codec list as the comma-joined string go2rtc expects on the wire.
export const convertToCodecString = (codecs: readonly string[]): string =>
  codecs.join(',');
