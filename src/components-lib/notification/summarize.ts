import { Notification } from '../../config/schema/actions/types.js';

export const summarizeNotification = (notification: Notification): string | null => {
  const text = notification.body?.text ?? notification.heading?.text ?? null;
  if (!text) {
    return null;
  }
  const metadata = notification.metadata?.map((m) => m.text).join(', ');
  return metadata ? `${text} [${metadata}]` : text;
};
