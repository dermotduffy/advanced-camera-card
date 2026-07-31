/**
 * Determine whether focus currently rests on an element, or on any of its
 * descendants (including those inside nested shadow roots).
 */
export const isFocusWithin = (element: Element): boolean => {
  const root = element.getRootNode();

  // Focus is reported per tree, with a shadow host standing in for whatever is
  // focused inside it, so the element's own tree is the one that will name it.
  const active =
    root instanceof Document || root instanceof ShadowRoot ? root.activeElement : null;

  return !!active && element.contains(active);
};
