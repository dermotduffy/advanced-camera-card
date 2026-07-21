import { BUTTON_SIZE_MIN } from '../../../../../config/schema/common/const';
import type {
  HAFormExpandableSchema,
  HASelectSelectorOption,
} from '../../../../../ha/types';
import { localize } from '../../../../../localize/localize';
import { createNumberSelector, createSelectSelector } from '../selectors';

/**
 * Get the schema for the next/previous controls.
 * @param options Which style and auto-hide values to offer (they vary by
 * section: `thumbnails` and `icons` styles and the `call` auto-hide only apply
 * where the section supports them).
 * @returns The form schema.
 */
export const getNextPreviousSchema = (options?: {
  allowIcons?: boolean;
  allowThumbnails?: boolean;
  allowCall?: boolean;
}): HAFormExpandableSchema => {
  const styleOptions: HASelectSelectorOption[] = [
    {
      value: 'chevrons',
      label: localize('config.common.controls.next_previous.styles.chevrons'),
    },
  ];
  if (options?.allowIcons) {
    styleOptions.push({
      value: 'icons',
      label: localize('config.common.controls.next_previous.styles.icons'),
    });
  }
  styleOptions.push({
    value: 'none',
    label: localize('config.common.controls.next_previous.styles.none'),
  });
  if (options?.allowThumbnails) {
    styleOptions.push({
      value: 'thumbnails',
      label: localize('config.common.controls.next_previous.styles.thumbnails'),
    });
  }

  const autoHideOptions: HASelectSelectorOption[] = [];
  if (options?.allowCall) {
    autoHideOptions.push({
      value: 'call',
      label: localize('config.common.auto_hide_conditions.call'),
    });
  }
  autoHideOptions.push({
    value: 'casting',
    label: localize('config.common.auto_hide_conditions.casting'),
  });

  return {
    name: 'next_previous',
    type: 'expandable',
    title: localize('config.common.controls.next_previous.editor_label'),
    icon: 'mdi:arrow-right-bold-circle',
    schema: [
      {
        name: 'style',
        label: localize('config.common.controls.next_previous.style'),
        selector: createSelectSelector(styleOptions),
      },
      {
        name: 'size',
        label: localize('config.common.controls.next_previous.size'),
        selector: createNumberSelector({ min: BUTTON_SIZE_MIN }),
      },
      {
        name: 'auto_hide',
        label: localize('config.common.controls.next_previous.auto_hide'),
        selector: createSelectSelector(autoHideOptions, { multiple: true }),
      },
    ],
  };
};
