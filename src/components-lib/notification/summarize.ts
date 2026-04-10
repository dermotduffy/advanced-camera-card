import { Notification } from '../../config/schema/actions/types.js';

export const summarizeNotification = (notification: Notification): string | null =>
  notification.body?.text ?? notification.heading?.text ?? null;
