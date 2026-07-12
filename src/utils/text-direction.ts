export type TextDirection = 'ltr' | 'rtl';

export const getTextDirection = (
  element: HTMLElement | null | undefined,
): TextDirection => {
  // `element` may be null/undefined, or detached from a document whose view is
  // no longer live (mobile lifecycle races: tab switch, picture-in-picture,
  // re-layout). Calling `getComputedStyle` in those states throws, e.g.
  // "Failed to execute 'getComputedStyle' on 'Window': parameter 1 is not of
  // type 'Element'" (Firefox: "Argument 1 is not an object"). Resolve the view
  // from the element itself and fall back to the default direction rather than
  // throwing. Regression guard for #2410 (previously #1909, #1217).
  const view = element?.ownerDocument.defaultView;
  if (!element || !view) {
    return 'ltr';
  }
  return view.getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
};
