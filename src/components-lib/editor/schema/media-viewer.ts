import type { HAFormExpandableSchema } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { getNextPreviousSchema } from './common/controls/next-previous';
import { getPTZSchema } from './common/controls/ptz';
import { getThumbnailsSchema } from './common/controls/thumbnails';
import { getMiniTimelineSchema } from './common/controls/timeline';
import { getDisplaySchema } from './common/display';
import {
  getMediaActionNegativeOptions,
  getMediaActionPositiveOptions,
} from './common/media-actions';
import { createSelectSelector } from './common/selectors';
import { getTransitionEffectSchema } from './common/transition-effect';

const getControlsSchema = (): HAFormExpandableSchema => ({
  name: 'controls',
  type: 'expandable',
  title: localize('config.media_viewer.controls.editor_label'),
  icon: 'mdi:gamepad',
  schema: [
    {
      name: 'builtin',
      label: localize('config.common.controls.builtin'),
      selector: { boolean: {} },
    },
    {
      name: 'wheel',
      label: localize('config.common.controls.wheel'),
      selector: { boolean: {} },
    },
    getNextPreviousSchema({ allowThumbnails: true }),
    getThumbnailsSchema({ includeMode: true }),
    getMiniTimelineSchema(),
    getPTZSchema({ includeAutoMode: false }),
  ],
});

/**
 * Get the forms for the media viewer section.
 * @returns The section forms.
 */
export const getMediaViewerSectionForms = (): EditorForm[] => [
  {
    basePath: ['media_viewer'],
    schema: [
      {
        name: 'auto_play',
        selector: createSelectSelector(getMediaActionPositiveOptions(), {
          multiple: true,
        }),
      },
      {
        name: 'auto_pause',
        selector: createSelectSelector(getMediaActionNegativeOptions(), {
          multiple: true,
        }),
      },
      {
        name: 'auto_mute',
        selector: createSelectSelector(getMediaActionNegativeOptions(), {
          multiple: true,
        }),
      },
      {
        name: 'auto_unmute',
        selector: createSelectSelector(getMediaActionPositiveOptions(), {
          multiple: true,
        }),
      },
      { name: 'draggable', selector: { boolean: {} } },
      { name: 'zoomable', selector: { boolean: {} } },
      { name: 'lazy_load', selector: { boolean: {} } },
      getTransitionEffectSchema(),
      { name: 'snapshot_click_plays_clip', selector: { boolean: {} } },
      getDisplaySchema(),
      getControlsSchema(),
    ],
  },
];
