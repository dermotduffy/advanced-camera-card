import type { Notification } from '../../config/schema/actions/types.js';
import { TROUBLESHOOTING_URL } from '../../const.js';
import { localize } from '../../localize/localize.js';

// A narrower type (than Notification) for UX consistency across the notifications
// shown over a media surface: provider errors, the awaiting-live placeholder, and
// the viewer/gallery no-media state.
export interface MediaNotificationOptions {
  // A short title identifying the situation.
  title: string;

  // The icon. Defaults to a generic alert icon; `null` for no icon at all.
  icon?: string | null;

  // Appended to the title to identify the media, when it has a title (e.g. the
  // camera title `: Front Door`). Absent for untitled media (a url or
  // screensaver image).
  targetTitle?: string;

  // A longer explanation. When present, the title moves to a prominent heading
  // and this text goes in the body underneath. When absent, the title alone
  // goes in the body for lighter visual weight.
  detail?: string;

  // Whether to show the retry spinner. A failing media surface is retried, so
  // this defaults to true.
  inProgress?: boolean;

  // Whether to show the troubleshooting link. Defaults to true.
  troubleshooting?: boolean;
}

// The standard notification block shown over a media surface (a camera stream, a
// non-camera url/screensaver image, or an empty viewer/gallery): title with an
// optional detail, an optional troubleshooting link, and a retry spinner. When
// detail is present the title is a prominent heading; when absent the title sits
// in the body for lighter visual weight.
export const createMediaNotification = (
  options: MediaNotificationOptions,
): Notification => {
  const text = options.targetTitle
    ? `${options.title}: ${options.targetTitle}`
    : options.title;
  const titleRow = {
    ...(options.icon !== null && { icon: options.icon ?? 'mdi:alert-circle' }),
    text,
  };

  return {
    ...(options.detail
      ? { heading: titleRow, body: { text: options.detail } }
      : { body: titleRow }),
    ...((options.troubleshooting ?? true) && {
      link: {
        url: TROUBLESHOOTING_URL,
        title: localize('error.troubleshooting'),
      },
    }),
    ...((options.inProgress ?? true) && { in_progress: true }),
  };
};
