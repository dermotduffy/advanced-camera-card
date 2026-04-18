import { z } from 'zod';
import { ExpiringEqualityCache } from '../../cache/expiring-cache';

export interface BrowseMediaMetadata {
  cameraID?: string;
  startDate?: Date;
  endDate?: Date;
  what?: string[];
}

// Server side data-type defined here: https://github.com/home-assistant/core/blob/dev/homeassistant/components/media_player/browse_media.py#L90
export const browseMediaSchema = z.object({
  title: z.string(),
  media_class: z.string(),
  media_content_type: z.string(),
  media_content_id: z.string(),
  can_play: z.boolean(),
  can_expand: z.boolean(),
  children_media_class: z.string().nullable().optional(),
  thumbnail: z.string().nullable(),

  get children() {
    // Recursive schema.
    return z.array(browseMediaSchema).nullable().optional();
  },
});
export type BrowseMedia = z.infer<typeof browseMediaSchema>;

export interface RichBrowseMedia<M> extends BrowseMedia {
  _metadata?: M;
  children?: RichBrowseMedia<M>[] | null;
}

export class BrowseMediaCache<M = undefined> extends ExpiringEqualityCache<
  string,
  RichBrowseMedia<M>
> {}

export const MEDIA_CLASS_VIDEO = 'video' as const;
export const MEDIA_CLASS_IMAGE = 'image' as const;

export const BROWSE_MEDIA_CACHE_SECONDS = 60 as const;
