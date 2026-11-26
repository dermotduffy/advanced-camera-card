import type { DataURL } from '../types';
import { isDataURL } from './data-url';

/**
 * Read a blob as a `data:` URL. Resolves null when the reader produces
 * something other than a string, and rejects when the read fails.
 */
export const readBlobAsDataURL = (blob: Blob): Promise<DataURL | null> =>
  new Promise<DataURL | null>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(typeof result === 'string' && isDataURL(result) ? result : null);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
