/**
 * Walk up `element`'s ancestor chain (through shadow boundaries) looking for
 * an ancestor with the given tag name. Returns true if one is found and that
 * same element also appears in the event's composedPath — indicating the event
 * originated from within the same subtree as the element.
 */
export const isAncestorInEventPath = (
  element: Element,
  ev: Event,
  tagName: string,
): boolean => {
  const composedPath = ev.composedPath();
  let node: Node | null = element;
  while (node) {
    if (node instanceof Element && node.tagName.toLowerCase() === tagName) {
      return composedPath.includes(node);
    }
    node = node instanceof ShadowRoot ? node.host : node.parentNode;
  }
  return false;
};
