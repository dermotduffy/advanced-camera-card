import type { BrowseMedia } from '../../../ha/browse-media/types';
import type { TemplateMediaData } from '../../templates/types';

export const getTemplateMediaData = (media: BrowseMedia): TemplateMediaData => ({
  id: media.media_content_id,
  title: media.title,
  is_folder: media.can_expand,
});
