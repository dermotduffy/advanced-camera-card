import { PTZControlAction } from '../../config/schema/actions/custom/ptz';
import { Actions } from '../../config/schema/actions/types';
import { PTZControlType } from '../../config/schema/common/controls/ptz';

interface PTZControlsViewContext {
  enabled?: boolean;
  type?: PTZControlType;
}
declare module 'view' {
  interface ViewContext {
    ptzControls?: PTZControlsViewContext;
  }
}

interface PTZPresetAction {
  preset: string;
  actions: Actions;
}

export type PTZControllerActions = {
  [K in PTZControlAction]?: Actions;
} & {
  presets?: PTZPresetAction[];
};
