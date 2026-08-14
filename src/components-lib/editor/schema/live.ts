import { BUTTON_SIZE_MIN } from '../../../config/schema/common/const';
import type { HAFormExpandableSchema } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { getNextPreviousSchema } from './common/controls/next-previous';
import { getPTZSchema } from './common/controls/ptz';
import { getThumbnailsSchema } from './common/controls/thumbnails';
import { getMiniTimelineSchema } from './common/controls/timeline';
import { getDisplaySchema } from './common/display';
import { createGrid } from './common/grid';
import {
  getLiveAutoMuteOptions,
  getLiveAutoUnmuteOptions,
  getMediaActionNegativeOptions,
  getMediaActionPositiveOptions,
  getMicrophoneMuteOptions,
  getMicrophoneUnmuteOptions,
} from './common/media-actions';
import { createNumberSelector, createSelectSelector } from './common/selectors';
import { getTransitionEffectSchema } from './common/transition-effect';

const getCallSchema = (): HAFormExpandableSchema => ({
  name: 'call',
  type: 'expandable',
  title: localize('config.live.controls.call.editor_label'),
  icon: 'mdi:phone',
  schema: [
    { name: 'enabled', selector: { boolean: {} } },
    { name: 'lock', selector: { boolean: {} } },
    {
      name: 'ringtone',
      type: 'expandable',
      title: localize('config.live.controls.call.ringtone.editor_label'),
      icon: 'mdi:music-note',
      schema: [
        createGrid([
          {
            name: 'type',
            selector: createSelectSelector([
              {
                value: 'none',
                label: localize('config.live.controls.call.ringtone.types.none'),
              },
              {
                value: 'chime',
                label: localize('config.live.controls.call.ringtone.types.chime'),
              },
              {
                value: 'westminster',
                label: localize('config.live.controls.call.ringtone.types.westminster'),
              },
              {
                value: 'arpeggio',
                label: localize('config.live.controls.call.ringtone.types.arpeggio'),
              },
              {
                value: 'melody',
                label: localize('config.live.controls.call.ringtone.types.melody'),
              },
              {
                value: 'custom',
                label: localize('config.live.controls.call.ringtone.types.custom'),
              },
            ]),
          },
          { name: 'url', selector: { text: {} } },
        ]),
        { name: 'repeat', selector: createNumberSelector({ min: 0 }) },
      ],
    },
    { name: 'unanswered_timeout_seconds', selector: createNumberSelector({ min: 0 }) },
    { name: 'button_size', selector: createNumberSelector({ min: BUTTON_SIZE_MIN }) },
  ],
});

const getControlsSchema = (): HAFormExpandableSchema => ({
  name: 'controls',
  type: 'expandable',
  title: localize('config.live.controls.editor_label'),
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
    getCallSchema(),
    getNextPreviousSchema({ allowIcons: true, allowCall: true }),
    getThumbnailsSchema({ includeMode: true }),
    getMiniTimelineSchema(),
    getPTZSchema({ includeAutoMode: true }),
  ],
});

const getMicrophoneSchema = (): HAFormExpandableSchema => ({
  name: 'microphone',
  type: 'expandable',
  title: localize('config.live.microphone.editor_label'),
  icon: 'mdi:microphone',
  schema: [
    { name: 'always_connected', selector: { boolean: {} } },
    {
      name: 'auto_mute',
      selector: createSelectSelector(getMicrophoneMuteOptions(), { multiple: true }),
    },
    {
      name: 'auto_unmute',
      selector: createSelectSelector(getMicrophoneUnmuteOptions(), { multiple: true }),
    },
    {
      name: 'mute_after_microphone_mute_seconds',
      selector: createNumberSelector({ min: 0 }),
    },
  ],
});

/**
 * Get the forms for the live section.
 * @returns The section forms.
 */
export const getLiveSectionForms = (): EditorForm[] => [
  {
    basePath: ['live'],
    schema: [
      { name: 'preload', selector: { boolean: {} } },
      createGrid([
        { name: 'draggable', selector: { boolean: {} } },
        { name: 'zoomable', selector: { boolean: {} } },
      ]),
      { name: 'lazy_load', selector: { boolean: {} } },
      {
        name: 'lazy_unload',
        selector: createSelectSelector(getMediaActionNegativeOptions(), {
          multiple: true,
        }),
      },
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
        selector: createSelectSelector(getLiveAutoMuteOptions(), { multiple: true }),
      },
      {
        name: 'auto_unmute',
        selector: createSelectSelector(getLiveAutoUnmuteOptions(), { multiple: true }),
      },
      getTransitionEffectSchema(),
      { name: 'show_image_during_load', selector: { boolean: {} } },
      getDisplaySchema(),
      getControlsSchema(),
      getMicrophoneSchema(),
    ],
  },
];
