import type {
  HAFormExpandableSchema,
  HASelectSelectorOption,
} from '../../../../../ha/types';
import { localize } from '../../../../../localize/localize';
import { createSelectSelector } from '../selectors';

// The PTZ controls are shared between live (physical or digital pan/tilt/zoom)
// and the media viewer (digital pan/zoom of the media). The label keys live
// under `config.common.controls.ptz` for both. Live offers an `auto` mode
// (physical PTZ when the camera supports it); the viewer is digital-only.
export const getPTZSchema = (options?: {
  includeAutoMode?: boolean;
}): HAFormExpandableSchema => {
  const modeOptions: HASelectSelectorOption[] = [
    { value: 'off', label: localize('config.common.controls.ptz.modes.off') },
  ];
  if (options?.includeAutoMode) {
    modeOptions.push({
      value: 'auto',
      label: localize('config.common.controls.ptz.modes.auto'),
    });
  }
  modeOptions.push({
    value: 'on',
    label: localize('config.common.controls.ptz.modes.on'),
  });

  return {
    name: 'ptz',
    type: 'expandable',
    title: localize('config.common.controls.ptz.editor_label'),
    icon: 'mdi:pan',
    schema: [
      {
        name: 'mode',
        label: localize('config.common.controls.ptz.mode'),
        selector: createSelectSelector(modeOptions),
      },
      {
        name: 'type',
        label: localize('config.common.controls.ptz.type'),
        selector: createSelectSelector([
          {
            value: 'buttons',
            label: localize('config.common.controls.ptz.types.buttons'),
          },
          {
            value: 'gestures',
            label: localize('config.common.controls.ptz.types.gestures'),
          },
        ]),
      },
      {
        name: 'position',
        label: localize('config.common.controls.ptz.position'),
        selector: createSelectSelector([
          {
            value: 'top-left',
            label: localize('config.common.controls.ptz.positions.top-left'),
          },
          {
            value: 'top-right',
            label: localize('config.common.controls.ptz.positions.top-right'),
          },
          {
            value: 'bottom-left',
            label: localize('config.common.controls.ptz.positions.bottom-left'),
          },
          {
            value: 'bottom-right',
            label: localize('config.common.controls.ptz.positions.bottom-right'),
          },
        ]),
      },
      {
        name: 'orientation',
        label: localize('config.common.controls.ptz.orientation'),
        selector: createSelectSelector([
          {
            value: 'vertical',
            label: localize('config.common.controls.ptz.orientations.vertical'),
          },
          {
            value: 'horizontal',
            label: localize('config.common.controls.ptz.orientations.horizontal'),
          },
        ]),
      },
      {
        name: 'hide_pan_tilt',
        label: localize('config.common.controls.ptz.hide_pan_tilt'),
        selector: { boolean: {} },
      },
      {
        name: 'hide_zoom',
        label: localize('config.common.controls.ptz.hide_zoom'),
        selector: { boolean: {} },
      },
      {
        name: 'hide_home',
        label: localize('config.common.controls.ptz.hide_home'),
        selector: { boolean: {} },
      },
      {
        name: 'hide_type',
        label: localize('config.common.controls.ptz.hide_type'),
        selector: { boolean: {} },
      },
    ],
  };
};
