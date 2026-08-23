import { userEvent } from 'vitest/browser';

// `querySelectorAll` does not look inside a shadow root, so a full search has
// to step through them a level at a time. The node's own root counts because a
// Lit element renders into that, not into its children.
const getImmediateShadowRoots = (root: ParentNode): ShadowRoot[] => {
  const roots = root instanceof Element && root.shadowRoot ? [root.shadowRoot] : [];
  for (const child of root.querySelectorAll('*')) {
    if (child.shadowRoot) {
      roots.push(child.shadowRoot);
    }
  }
  return roots;
};

/**
 * Get every shadow root at or below an element.
 */
export const getAllShadowRoots = (root: ParentNode): ShadowRoot[] =>
  getImmediateShadowRoots(root).flatMap((child) => [child, ...getAllShadowRoots(child)]);

/**
 * Search an element and every shadow root beneath it. The card nests its own
 * components several roots deep, and neither the source tree nor the node
 * suite has a helper for this.
 */
export const deepQuery = <T extends Element = Element>(
  root: ParentNode,
  selector: string,
): T | null => {
  const direct = root.querySelector<T>(selector);
  if (direct) {
    return direct;
  }
  for (const child of getImmediateShadowRoots(root)) {
    const found = deepQuery<T>(child, selector);
    if (found) {
      return found;
    }
  }
  return null;
};

/**
 * Every match for a selector across an element and the shadow roots beneath it,
 * for asking how many of something the card rendered rather than whether it
 * rendered any.
 */
export const deepQueryAll = <T extends Element = Element>(
  root: ParentNode,
  selector: string,
): T[] => [
  ...root.querySelectorAll<T>(selector),
  ...getImmediateShadowRoots(root).flatMap((child) => deepQueryAll<T>(child, selector)),
];

// `userEvent.keyboard` is given one string naming every key to press, in which
// a name of more than one character is wrapped in braces (`{Escape}`) and a
// single character stands for itself.
// See: https://vitest.dev/guide/browser/interactivity-api.html#userevent-keyboard
const asKeyboardInput = (key: string): string => (key.length === 1 ? key : `{${key}}`);

export const pressKey = async (key: string): Promise<void> =>
  await userEvent.keyboard(asKeyboardInput(key));

export const holdKey = async (key: string): Promise<void> =>
  await userEvent.keyboard(`{${key}>}`);

export const releaseKey = async (key: string): Promise<void> =>
  await userEvent.keyboard(`{/${key}}`);

export const pressTab = async (): Promise<void> => await userEvent.tab();

/**
 * Press Tab until the page reaches the state the caller is waiting for,
 * reporting whether it got there. `maximumPresses` is a runaway guard rather
 * than a count: a page that never reaches that state fails the caller instead
 * of tabbing forever.
 */
export const tabUntil = async (
  isReached: () => boolean,
  maximumPresses: number,
): Promise<boolean> => {
  for (let press = 0; press < maximumPresses; ++press) {
    await pressTab();
    if (isReached()) {
      return true;
    }
  }
  return false;
};

/**
 * Click an element with a real pointer, which is the only kind that carries the
 * browser's own behavior: the press moves focus, and an element that stops the
 * press doing so leaves it where it was.
 */
export const clickElement = async (element: Element): Promise<void> =>
  await userEvent.click(element);

/**
 * Send a `pointerdown` to an element without moving a real pointer, so the page
 * stays scrolled where the test left it: `clickElement` scrolls its target into
 * view before pressing it.
 *
 * The browser does nothing of its own with a press it did not itself deliver,
 * so what follows is only what the card's own listener does.
 */
export const dispatchPointerDown = (element: Element): void => {
  element.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true }),
  );
};

/**
 * The element that actually has focus. `document.activeElement` names the
 * outermost shadow host in the way, since focus is reported per tree.
 */
export const getFocusedElement = (): Element | null => {
  let focused = document.activeElement;
  while (focused?.shadowRoot?.activeElement) {
    focused = focused.shadowRoot.activeElement;
  }
  return focused;
};
