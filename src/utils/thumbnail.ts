import { Task } from '@lit/task';
import type { ReactiveControllerHost } from 'lit';

import { isMediaSourceID } from '../ha/media-source';
import { resolveMedia } from '../ha/resolved-media';
import type { HomeAssistant } from '../ha/types';
import { AdvancedCameraCardError } from '../types';

// See: https://github.com/sindresorhus/is-absolute-url
// Scheme: https://tools.ietf.org/html/rfc3986#section-3.1
// Absolute URL: https://tools.ietf.org/html/rfc3986#section-4.3
const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/;

/**
 * Fetch a thumbnail and return a data URL.
 * @param hass Home Assistant object.
 * @param thumbnail A thumbnail URL, or the Home Assistant media source ID of an
 * image.
 * @returns A base64 encoded data URL for the thumbnail.
 */
const fetchThumbnail = async (
  hass: HomeAssistant,
  thumbnail: string,
): Promise<string | null> => {
  // A media source ID is tested for first, as it would otherwise be taken for
  // an absolute URL.
  const thumbnailURL = isMediaSourceID(thumbnail)
    ? (await resolveMedia(hass, thumbnail))?.url
    : thumbnail;
  if (!thumbnailURL) {
    throw new AdvancedCameraCardError(`Could not resolve thumbnail: ${thumbnail}`);
  }

  if (thumbnailURL.startsWith('data:') || thumbnailURL.match(ABSOLUTE_URL_REGEX)) {
    return thumbnailURL;
  }
  // Since we are fetching with an authorization header, we cannot just put the
  // URL directly into the document; we need to embed the image. We could do this
  // using blob URLs, but then we would need to keep track of them in order to
  // release them properly. Instead, we embed the thumbnail using base64.
  const response = await hass.fetchWithAuth(thumbnailURL);
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  const blob = await response.blob();
  return new Promise<string | null>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(typeof result === 'string' ? result : null);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
};

export type FetchThumbnailTaskArgs = [boolean, string | undefined];

/**
 * Create a Lit task to fetch a thumbnail.
 * @param host The Lit Element.
 * @param getHASS A function to get the Home Assistant object.
 * @param getThumbnail A function to get the Thumbnail URL.
 * @returns A new Lit Task.
 */
export const createFetchThumbnailTask = (
  host: ReactiveControllerHost,
  getHASS: () => HomeAssistant | undefined,
  getThumbnailURL: () => string | undefined,
  autoRun = true,
): Task<FetchThumbnailTaskArgs, string | null> => {
  return new Task(host, {
    // Do not re-run the task if hass changes, unless it was previously undefined.
    args: (): FetchThumbnailTaskArgs => [!!getHASS(), getThumbnailURL()],
    task: async ([haveHASS, thumbnailURL]: FetchThumbnailTaskArgs): Promise<
      string | null
    > => {
      const hass = getHASS();
      if (!haveHASS || !hass || !thumbnailURL) {
        return null;
      }
      return await fetchThumbnail(hass, thumbnailURL);
    },
    autoRun: autoRun,
  });
};
