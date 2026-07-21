import type { HAFormExpandableSchema, HAFormSchema } from '../../../../../ha/types';
import { localize } from '../../../../../localize/localize';
import { createNumberSelector, createSelectSelector } from '../selectors';

/**
 * Get the schema for the core timeline fields (shared between the timeline
 * section and the mini timelines).
 * @param options Whether to include `pan_mode`. Its non-`pan` modes seek
 * within playing media, so only a mini timeline shown alongside media has it.
 * @returns The form schema.
 */
export const getTimelineCoreSchema = (options?: {
  includePanMode?: boolean;
}): HAFormSchema[] => {
  const schema: HAFormSchema[] = [
    {
      name: 'style',
      label: localize('config.common.timeline.style'),
      selector: createSelectSelector([
        { value: 'ribbon', label: localize('config.common.timeline.styles.ribbon') },
        { value: 'stack', label: localize('config.common.timeline.styles.stack') },
      ]),
    },
  ];
  if (options?.includePanMode) {
    schema.push({
      name: 'pan_mode',
      label: localize('config.common.controls.timeline.pan_mode'),
      selector: createSelectSelector([
        {
          value: 'pan',
          label: localize('config.common.controls.timeline.pan_modes.pan'),
        },
        {
          value: 'seek',
          label: localize('config.common.controls.timeline.pan_modes.seek'),
        },
        {
          value: 'seek-in-media',
          label: localize('config.common.controls.timeline.pan_modes.seek-in-media'),
        },
        {
          value: 'seek-in-camera',
          label: localize('config.common.controls.timeline.pan_modes.seek-in-camera'),
        },
      ]),
    });
  }
  schema.push(
    {
      name: 'window_seconds',
      label: localize('config.common.timeline.window_seconds'),
      selector: createNumberSelector(),
    },
    {
      name: 'clustering_threshold',
      label: localize('config.common.timeline.clustering_threshold'),
      selector: createNumberSelector(),
    },
    {
      name: 'show_recordings',
      label: localize('config.common.timeline.show_recordings'),
      selector: { boolean: {} },
    },
    {
      name: 'format',
      type: 'expandable',
      title: localize('config.common.controls.timeline.format.editor_label'),
      icon: 'mdi:clock-edit',
      schema: [
        {
          name: '24h',
          label: localize('config.common.controls.timeline.format.24h'),
          selector: { boolean: {} },
        },
      ],
    },
  );
  return schema;
};

/**
 * Get the schema for a mini timeline (the timeline shown for
 * live/media_viewer): the placement `mode` plus the shared core fields
 * (including `pan_mode`, which only mini timelines honor).
 * @returns The expandable form schema.
 */
export const getMiniTimelineSchema = (): HAFormExpandableSchema => ({
  name: 'timeline',
  type: 'expandable',
  title: localize('config.common.controls.timeline.editor_label'),
  icon: 'mdi:chart-gantt',
  schema: [
    {
      name: 'mode',
      label: localize('config.common.controls.timeline.mode'),
      selector: createSelectSelector([
        { value: 'none', label: localize('config.common.controls.timeline.modes.none') },
        {
          value: 'above',
          label: localize('config.common.controls.timeline.modes.above'),
        },
        {
          value: 'below',
          label: localize('config.common.controls.timeline.modes.below'),
        },
      ]),
    },
    ...getTimelineCoreSchema({ includePanMode: true }),
  ],
});
