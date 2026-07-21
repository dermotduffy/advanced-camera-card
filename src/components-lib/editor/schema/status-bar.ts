import { STATUS_BAR_PRIORITY_MAX } from '../../../config/schema/common/const';
import { STATUS_BAR_HEIGHT_MIN } from '../../../config/schema/status-bar';
import type { HAFormExpandableSchema } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import type { EditorForm } from '../types';
import { createNumberSelector, createSelectSelector } from './common/selectors';

const STATUS_BAR_ITEMS = [
  'engine',
  'issues',
  'resolution',
  'severity',
  'technology',
  'title',
];

const getStatusBarItemSchema = (item: string): HAFormExpandableSchema => ({
  name: item,
  type: 'expandable',
  title: localize(`config.status_bar.items.${item}`),
  icon: 'mdi:feature-search',
  schema: [
    {
      name: 'enabled',
      label: localize('config.status_bar.items.enabled'),
      selector: { boolean: {} },
    },
    {
      name: 'permanent',
      label: localize('config.status_bar.items.permanent'),
      selector: { boolean: {} },
    },
    {
      name: 'priority',
      label: localize('config.status_bar.items.priority'),
      selector: createNumberSelector({ max: STATUS_BAR_PRIORITY_MAX }),
    },
  ],
});

/**
 * Get the forms for the status bar section.
 * @returns The section forms.
 */
export const getStatusBarSectionForms = (): EditorForm[] => [
  {
    basePath: ['status_bar'],
    schema: [
      {
        name: 'style',
        selector: createSelectSelector([
          { value: 'hover', label: localize('config.status_bar.styles.hover') },
          {
            value: 'hover-card',
            label: localize('config.status_bar.styles.hover-card'),
          },
          { value: 'none', label: localize('config.status_bar.styles.none') },
          { value: 'outside', label: localize('config.status_bar.styles.outside') },
          { value: 'overlay', label: localize('config.status_bar.styles.overlay') },
          { value: 'popup', label: localize('config.status_bar.styles.popup') },
        ]),
      },
      {
        name: 'position',
        selector: createSelectSelector([
          { value: 'top', label: localize('config.status_bar.positions.top') },
          { value: 'bottom', label: localize('config.status_bar.positions.bottom') },
        ]),
      },
      {
        name: 'auto_hide',
        selector: createSelectSelector(
          [
            {
              value: 'call',
              label: localize('config.common.auto_hide_conditions.call'),
            },
            {
              value: 'casting',
              label: localize('config.common.auto_hide_conditions.casting'),
            },
          ],
          { multiple: true },
        ),
      },
      {
        name: 'height',
        selector: createNumberSelector({ min: STATUS_BAR_HEIGHT_MIN }),
      },
      {
        name: 'popup_seconds',
        selector: createNumberSelector({ min: 0, max: 60 }),
      },
    ],
  },
  {
    basePath: ['status_bar', 'items'],
    schema: STATUS_BAR_ITEMS.map(getStatusBarItemSchema),
  },
];
