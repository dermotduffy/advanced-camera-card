import type { AdvancedCameraCardConfig } from '../config/schema/types';

// What a card keeps for a camera beyond its own life (e.g. its last frame or
// zoom, which a card built again on a return to its dashboard picks up) is
// keyed by card and camera. Cards without a `card_id` share it for the same
// camera ID.
export interface CardCameraKey {
  cardID?: AdvancedCameraCardConfig['card_id'];
  cameraID: string;
}

/** The key as a string, so it compares by value (e.g. as a map key). */
export const encodeCardCameraKey = (key: CardCameraKey): string =>
  JSON.stringify([key.cardID, key.cameraID]);
