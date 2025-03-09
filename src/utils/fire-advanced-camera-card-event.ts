/**
 * Dispatch an Advanced Camera Card event.
 * @param target The target from which send the event.
 * @param type The type of the Advanced Camera Card event to send.
 * @param detail An optional detail object to attach.
 */
export function fireAdvancedCameraCardEvent<T>(
  target: EventTarget,
  type: string,
  detail?: T,
  options?: {
    bubbles?: boolean;
    cancelable?: boolean;
    composed?: boolean;
  },
): void {
  target.dispatchEvent(
    new CustomEvent<T>(`advanced-camera-card:${type}`, {
      bubbles: options?.bubbles ?? true,
      composed: options?.composed ?? true,
      cancelable: options?.cancelable ?? false,
      detail: detail,
    }),
  );
}
