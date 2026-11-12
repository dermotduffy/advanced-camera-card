/**
 * Elements may render before card initialization unless they contain templates.
 * Template-backed elements must wait until the renderer is ready so raw template
 * values are never displayed or evaluated.
 */
export const areElementsReady = (
  hasTemplate: boolean,
  isTemplateRendererInitialized: boolean,
): boolean => !hasTemplate || isTemplateRendererInitialized;
