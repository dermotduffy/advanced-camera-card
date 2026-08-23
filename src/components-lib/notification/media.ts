import type { Notification } from '../../config/schema/actions/types.js';
import { TROUBLESHOOTING_URL } from '../../const.js';
import { localize } from '../../localize/localize.js';

// A narrower type (than Notification) for UX consistency across the notifications
// shown over a media surface: provider errors, the awaiting-live placeholder, and
// the viewer/gallery no-media state.
export interface MediaNotificationOptions {
  // A short heading. A longer explanation goes in `detail`.
  title: string;

  // The heading icon. Defaults to a generic alert icon; `null` for no icon at
  // all.
  icon?: string | null;

  // Appended to the heading to identify the media, when it has a title (e.g. the
  // camera title `: Front Door`). Absent for untitled media (a url or
  // screensaver image).
  targetTitle?: string;

  // A longer explanation, shown as the body when the title alone is not enough.
  detail?: string;

  // Whether to show the retry spinner. A failing media surface is retried, so
  // this defaults to true.
  inProgress?: boolean;

  // Whether to show the troubleshooting link. Defaults to true.
  troubleshooting?: boolean;
}

// The standard notification block shown over a media surface (a camera stream, a
// non-camera url/screensaver image, or an empty viewer/gallery): a short titled
// heading (with the media title when there is one), an optional longer detail, an
// optional troubleshooting link, and a retry spinner.
export const createMediaNotification = (
  options: MediaNotificationOptions,
): Notification => ({
  heading: {
    ...(options.icon !== null && { icon: options.icon ?? 'mdi:alert-circle' }),
    text: options.targetTitle
      ? `${options.title}: ${options.targetTitle}`
      : options.title,
  },
  ...(options.detail && { body: { text: options.detail } }),
  ...((options.troubleshooting ?? true) && {
    link: {
      url: TROUBLESHOOTING_URL,
      title: localize('error.troubleshooting'),
    },
  }),
  ...((options.inProgress ?? true) && { in_progress: true }),
});
