import { html, LitElement, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { ElementActionsController } from '../../src/components-lib/element-actions-controller';
import { flushPromises } from '../test-utils';

/**
 * An element shaped like Home Assistant's `state-icon`, which renders again
 * only when told that the configuration it was given changed, or that it has
 * been given Home Assistant for the first time. It records whether it was
 * delegating its actions each time it rendered.
 */
class RenderGatingElement extends LitElement {
  @property({ attribute: false })
  public hass?: object;

  @state()
  private _config?: object;

  public delegatedActions = true;
  public delegatedActionsWhenRendered: boolean[] = [];

  public setConfig(config: object): void {
    this._config = config;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    return (
      changedProps.has('_config') ||
      (changedProps.has('hass') && !changedProps.get('hass'))
    );
  }

  protected render(): TemplateResult {
    if (this._config) {
      this.delegatedActionsWhenRendered.push(this.delegatedActions);
    }
    return html``;
  }
}
customElements.define('render-gating-test-element', RenderGatingElement);

const createDelegatingElement = () =>
  Object.assign(document.createElement('div'), {
    delegatedActions: true,
    requestUpdate: vi.fn(),
  });

const createSelfHandlingElement = () =>
  Object.assign(document.createElement('div'), {
    delegatedActions: false,
    requestUpdate: vi.fn(),
  });

// @vitest-environment jsdom
describe('ElementActionsController', () => {
  describe('should handle a tree that is already built', () => {
    it('should stop an element delegating its actions', () => {
      const root = document.createElement('div');
      const element = createDelegatingElement();
      root.appendChild(element);

      new ElementActionsController().setRoot(root);

      expect(element.delegatedActions).toBe(false);
      expect(element.requestUpdate).toHaveBeenCalled();
    });

    it('should stop a nested element delegating its actions', () => {
      const root = document.createElement('div');
      const conditional = document.createElement('div');
      const element = createDelegatingElement();
      conditional.appendChild(element);
      root.appendChild(conditional);

      new ElementActionsController().setRoot(root);

      expect(element.delegatedActions).toBe(false);
      expect(element.requestUpdate).toHaveBeenCalled();
    });

    it('should stop the root itself delegating its actions', () => {
      const root = createDelegatingElement();

      new ElementActionsController().setRoot(root);

      expect(root.delegatedActions).toBe(false);
      expect(root.requestUpdate).toHaveBeenCalled();
    });

    it('should leave an element alone when it handles its own actions', () => {
      const root = document.createElement('div');
      const element = createSelfHandlingElement();
      root.appendChild(element);

      new ElementActionsController().setRoot(root);

      expect(element.delegatedActions).toBe(false);
      expect(element.requestUpdate).not.toHaveBeenCalled();
    });

    it('should leave an element alone when Home Assistant does not delegate its actions', () => {
      const root = document.createElement('div');
      const element = Object.assign(document.createElement('div'), {
        requestUpdate: vi.fn(),
      });
      root.appendChild(element);

      new ElementActionsController().setRoot(root);

      expect(element.requestUpdate).not.toHaveBeenCalled();
    });

    it('should continue to handle the tree when an element throws', () => {
      const root = document.createElement('div');
      const refusing = Object.assign(document.createElement('div'), {
        delegatedActions: true,
        requestUpdate: () => {
          throw new Error('refused');
        },
      });
      const element = createDelegatingElement();
      root.append(refusing, element);

      new ElementActionsController().setRoot(root);

      expect(element.delegatedActions).toBe(false);
      expect(element.requestUpdate).toHaveBeenCalled();
    });

    it('should leave an element alone when it cannot be asked to render again', () => {
      const root = document.createElement('div');

      // An element that never renders again keeps whatever it bound at its last
      // render, so there is nothing to gain by changing it. 'div' has no
      // 'requestUpdate' method.
      const element = Object.assign(document.createElement('div'), {
        delegatedActions: true,
      });
      root.appendChild(element);

      new ElementActionsController().setRoot(root);

      expect(element.delegatedActions).toBe(true);
    });
  });

  describe('should handle a tree that changes', () => {
    it('should stop an element added later from delegating its actions', async () => {
      const root = document.createElement('div');
      new ElementActionsController().setRoot(root);

      const element = createDelegatingElement();
      root.appendChild(element);
      await flushPromises();

      expect(element.delegatedActions).toBe(false);
      expect(element.requestUpdate).toHaveBeenCalled();
    });

    it('should stop a nested element added later delegating its actions', async () => {
      const root = document.createElement('div');
      new ElementActionsController().setRoot(root);

      const conditional = document.createElement('div');
      const element = createDelegatingElement();
      conditional.appendChild(element);
      root.appendChild(conditional);
      await flushPromises();

      expect(element.delegatedActions).toBe(false);
      expect(element.requestUpdate).toHaveBeenCalled();
    });

    it('should ignore text added later', async () => {
      const root = document.createElement('div');
      new ElementActionsController().setRoot(root);

      root.appendChild(document.createTextNode('text'));
      const element = createDelegatingElement();
      root.appendChild(element);
      await flushPromises();

      expect(element.delegatedActions).toBe(false);
    });

    it('should ignore a tree that has been replaced', async () => {
      const replacedRoot = document.createElement('div');
      const controller = new ElementActionsController();
      controller.setRoot(replacedRoot);
      controller.setRoot(document.createElement('div'));

      const element = createDelegatingElement();
      replacedRoot.appendChild(element);
      await flushPromises();

      expect(element.delegatedActions).toBe(true);
      expect(element.requestUpdate).not.toHaveBeenCalled();
    });
  });

  it('should force an element to re-render even if it gates rendering', async () => {
    const holder = document.createElement('div');
    document.body.appendChild(holder);
    onTestFinished(() => holder.remove());

    const element = new RenderGatingElement();

    element.setConfig({});
    element.hass = { name: 'first' };
    holder.appendChild(element);
    await element.updateComplete;

    expect(element.delegatedActionsWhenRendered).toEqual([true]);

    const root = document.createElement('div');
    new ElementActionsController().setRoot(root);

    // The order matters: the element joins the tree, and is given a new Home
    // Assistant only afterwards. It is then already waiting to render, holding
    // the Home Assistant it had before to compare against, and would find
    // nothing changed were it asked to render by naming Home Assistant alone.
    // This tests that the '_config' request is what triggers the re-render.
    root.appendChild(element);
    element.hass = { name: 'second' };
    await element.updateComplete;

    expect(element.delegatedActions).toBe(false);
    expect(element.delegatedActionsWhenRendered).toEqual([true, false]);
  });
});

declare global {
  interface HTMLElementTagNameMap {
    'render-gating-test-element': RenderGatingElement;
  }
}
