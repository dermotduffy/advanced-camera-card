import { errorToConsole } from '../utils/basic';

// A picture element that expects the container rendering it to dispatch its
// actions for it.
interface ActionDelegatingElement extends HTMLElement {
  delegatedActions: boolean;
  requestUpdate: (name?: PropertyKey, oldValue?: unknown) => void;
}

const isActionDelegatingElement = (node: Node): node is ActionDelegatingElement =>
  node instanceof HTMLElement &&
  'delegatedActions' in node &&
  node.delegatedActions === true &&
  'requestUpdate' in node &&
  typeof node.requestUpdate === 'function';

/**
 * Home Assistant picture elements of some types (e.g. `icon`, `state-icon`) do
 * not listen for taps themselves. They expect the container rendering them to
 * work out which element a tap belongs to and to dispatch the action on their
 * behalf, so that a tap landing between two elements still reaches the nearest
 * one. This card is *not* such a container: taps that miss an element need to
 * pass through its elements overlay to the media beneath, so it only ever sees
 * a tap that landed on an element. This tells each element to listen for its
 * own taps instead.
 */
export class ElementActionsController {
  private _observer = new MutationObserver(this._handleMutations.bind(this));

  /**
   * Set the tree of elements that should listen for their own taps. Elements
   * that join the tree later (e.g. those of a conditional element whose
   * conditions become true) are handled as they arrive.
   * @param root The root of the element tree.
   */
  public setRoot(root: Element): void {
    this._observer.disconnect();
    this._observer.observe(root, { childList: true, subtree: true });
    this._stopDelegationInSubtree(root);
  }

  private _handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        this._stopDelegationInSubtree(node);
      }
    }
  }

  private _stopDelegationInSubtree(node: Node): void {
    this._stopDelegation(node);

    if (node instanceof Element) {
      for (const descendant of node.querySelectorAll('*')) {
        this._stopDelegation(descendant);
      }
    }
  }

  private _stopDelegation(node: Node): void {
    if (!isActionDelegatingElement(node)) {
      return;
    }

    try {
      node.delegatedActions = false;

      // The element decides whether to listen for taps as it renders, so it
      // must render again for the change to take effect. Some element types
      // (e.g. icons) do not render for every Home Assistant they are given,
      // only when something they read out of it changed, so naming Home
      // Assistant may not be sufficient to trigger a re-render. Naming the
      // configuration (as it is named in stock HA elements) is the one they
      // always act on; Home Assistant is a fallback should the configuration
      // ever be named something else.
      node.requestUpdate('_config', undefined);
      node.requestUpdate('hass', undefined);
    } catch (e) {
      errorToConsole(e);
    }
  }
}
