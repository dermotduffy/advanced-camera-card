/**
 * Get the host of the shadow root an element lives in, or `null` when the
 * element is not in a shadow tree (in the light DOM, or not connected).
 */
export const getShadowRootHost = (element: Node): Element | null => {
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
};
