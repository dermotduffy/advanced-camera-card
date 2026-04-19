import { Notification, NotificationDetail } from '../../config/schema/actions/types.js';
import { Link } from '../../config/schema/common/link.js';
import { getContextFromError } from '../../utils/error-context.js';
import { dataToContext } from './data-to-context.js';

const DEFAULT_ERROR_ICON = 'mdi:alert';

export interface NotificationOptions {
  heading?: NotificationDetail;
  icon?: string;
  link?: Link;
  metadata?: NotificationDetail[];
  context?: object;
  in_progress?: boolean;
}

export const createNotificationFromText = (
  text: string,
  options?: NotificationOptions,
): Notification => ({
  ...(options?.heading && { heading: options.heading }),
  body: {
    text,
    ...((options?.icon || !options?.heading) && {
      icon: options?.icon ?? DEFAULT_ERROR_ICON,
    }),
  },
  ...(options?.metadata && { metadata: options.metadata }),
  ...(options?.link && { link: options.link }),
  ...(options?.context && {
    context: dataToContext(options.context),
  }),
  ...(options?.in_progress !== undefined && { in_progress: options.in_progress }),
});

export const createNotificationFromError = (
  error: unknown,
  options?: NotificationOptions,
): Notification | null => {
  if (error == null) {
    return null;
  }

  const text =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : typeof error === 'object'
        ? JSON.stringify(error)
        : String(error);

  const context = options?.context ?? getContextFromError(error) ?? undefined;

  return createNotificationFromText(text, {
    ...options,
    context,
    heading: options?.heading
      ? { icon: DEFAULT_ERROR_ICON, severity: 'high', ...options.heading }
      : undefined,
  });
};
