export interface LiveViewContext {
  // A cameraID override (used for dependencies/substreams to force a different
  // camera to be live rather than the camera selected in the view).
  overrides?: Map<string, string>;
}

declare module 'view' {
  interface ViewContext {
    live?: LiveViewContext;
  }
}
