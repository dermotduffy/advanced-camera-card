import type { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';

/**
 * A folder's picture is a logo or a sample of what it holds, so only its name
 * says which folder it is. A frame of a media item identifies the item itself.
 * @param item The item.
 * @returns `true` if the item needs no name beside its thumbnail.
 */
export const isIdentifiedByThumbnail = (item?: ViewItem): boolean =>
  ViewItemClassifier.isMedia(item) && !!item.getThumbnail();
