import {
  THUMBNAIL_SIZE_MAX,
  THUMBNAIL_SIZE_MIN,
} from '../../../../../config/schema/common/controls/thumbnails';
import type { HAFormExpandableSchema, HAFormSchema } from '../../../../../ha/types';
import { localize } from '../../../../../localize/localize';
import { createGrid } from '../grid';
import { createNumberSelector, createSelectSelector } from '../selectors';

/**
 * Get the schema for a thumbnails control group.
 * @param options Whether to include the mode field.
 * @returns The form schema for the group.
 */
export const getThumbnailsSchema = (options?: {
  includeMode?: boolean;
}): HAFormExpandableSchema => {
  const sizeField: HAFormSchema = {
    name: 'size',
    label: localize('config.common.controls.thumbnails.size'),
    selector: createNumberSelector({
      min: THUMBNAIL_SIZE_MIN,
      max: THUMBNAIL_SIZE_MAX,
    }),
  };

  const detailsStyleField: HAFormSchema = {
    name: 'details_style',
    label: localize('config.common.controls.thumbnails.details_style'),
    selector: createSelectSelector([
      {
        value: 'auto',
        label: localize('config.common.controls.thumbnails.details_styles.auto'),
      },
      {
        value: 'none',
        label: localize('config.common.controls.thumbnails.details_styles.none'),
      },
      {
        value: 'overlay',
        label: localize('config.common.controls.thumbnails.details_styles.overlay'),
      },
      {
        value: 'hover',
        label: localize('config.common.controls.thumbnails.details_styles.hover'),
      },
      {
        value: 'panel',
        label: localize('config.common.controls.thumbnails.details_styles.panel'),
      },
    ]),
  };

  const schema: HAFormSchema[] = [];
  if (options?.includeMode) {
    // Where the thumbnails go and how big they are: both describe the space
    // they take up.
    schema.push(
      createGrid([
        {
          name: 'mode',
          label: localize('config.common.controls.thumbnails.mode'),
          selector: createSelectSelector([
            {
              value: 'none',
              label: localize('config.common.controls.thumbnails.modes.none'),
            },
            {
              value: 'above',
              label: localize('config.common.controls.thumbnails.modes.above'),
            },
            {
              value: 'below',
              label: localize('config.common.controls.thumbnails.modes.below'),
            },
            {
              value: 'left',
              label: localize('config.common.controls.thumbnails.modes.left'),
            },
            {
              value: 'right',
              label: localize('config.common.controls.thumbnails.modes.right'),
            },
          ]),
        },
        sizeField,
      ]),
    );
  } else {
    schema.push(sizeField);
  }
  schema.push(detailsStyleField);
  schema.push(
    createGrid([
      {
        name: 'show_favorite_control',
        label: localize('config.common.controls.thumbnails.show_favorite_control'),
        selector: { boolean: {} },
      },
      {
        name: 'show_timeline_control',
        label: localize('config.common.controls.thumbnails.show_timeline_control'),
        selector: { boolean: {} },
      },
      {
        name: 'show_download_control',
        label: localize('config.common.controls.thumbnails.show_download_control'),
        selector: { boolean: {} },
      },
      {
        name: 'show_review_control',
        label: localize('config.common.controls.thumbnails.show_review_control'),
        selector: { boolean: {} },
      },
      {
        name: 'show_info_control',
        label: localize('config.common.controls.thumbnails.show_info_control'),
        selector: { boolean: {} },
      },
    ]),
  );
  return {
    name: 'thumbnails',
    type: 'expandable',
    title: localize('config.common.controls.thumbnails.editor_label'),
    icon: 'mdi:image-text',
    schema,
  };
};
