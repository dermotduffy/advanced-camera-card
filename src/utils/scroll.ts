import { compute as computeScroll, type Options } from 'compute-scroll-into-view';

// Alternative to the stock element.scrollIntoView that suppports limiting
// scrolling to a boundary, rather than the entire browser root.
//
// See: https://github.com/dermotduffy/advanced-camera-card/issues/1814
// See: https://github.com/w3c/csswg-drafts/issues/9452
export const scrollIntoView = (element: HTMLElement, options: Options) => {
  computeScroll(element, options).forEach(({ el, top, left }) => {
    el.scrollTop = top;
    el.scrollLeft = left;
  });
};
