import { View } from '../view/view';

export type CallViewState = 'connecting_call' | 'in_call' | 'ending_call';

export interface CallViewContext {
  camera?: string;
  stream?: string;
  state?: CallViewState;
}

declare module 'view' {
  interface ViewContext {
    call?: CallViewContext;
  }
}

export const getCallStream = (view: View, cameraID?: string): string | null => {
  const targetCameraID = cameraID ?? view.camera;
  return view.context?.call?.camera === targetCameraID
    ? view.context.call.stream ?? null
    : null;
};

export const setCallContext = (view: View, callContext: CallViewContext): void => {
  view.mergeInContext({
    call: {
      ...view.context?.call,
      ...callContext,
    },
  });
};

export const removeCallContext = (view: View): void => {
  view.removeContext('call');
};

export const removeCallState = (view: View): void => {
  view.removeContextProperty('call', 'state');
};
