import { PTZControlAction } from '../../config/ptz';
import { Actions } from '../../config/types';

interface PTZControlsViewContext {
  enabled?: boolean;
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
