import { html } from 'lit';
import { describe, expect, it, vi } from 'vitest';

import { SectionController } from '../../../src/components-lib/editor/section-controller';
import { createLitElement } from '../../test-utils';

const OPTIONS = { cameras: [], folders: [] };
const INPUT = { config: {}, defaults: {}, options: OPTIONS };

const createController = () => {
  const host = createLitElement();
  return { host, controller: new SectionController(host, () => html`doc`) };
};

// @vitest-environment jsdom
describe('SectionController', () => {
  it('should register with the host', () => {
    const { host, controller } = createController();
    expect(host.addController).toHaveBeenCalledWith(controller);
    controller.hostConnected();
  });

  it('should have no contexts before it is given a request', () => {
    const { controller } = createController();
    expect(controller.getContexts()).toEqual([]);
  });

  it('should build the forms of the requested section', () => {
    const { controller } = createController();

    controller.setInput({ kind: 'section', name: 'menu' }, INPUT);

    const contexts = controller.getContexts();
    expect(contexts.length).toBeGreaterThan(0);
    expect(contexts[0].form.basePath).toEqual(['menu']);
  });

  it('should report an edit as an intent', () => {
    const { host, controller } = createController();
    const listener = vi.fn();
    host.addEventListener('advanced-camera-card:editor:intent', listener);
    controller.setInput({ kind: 'section', name: 'menu' }, INPUT);

    controller
      .getContexts()[0]
      .valueChanged(
        new CustomEvent('value-changed', { detail: { value: { style: 'outside' } } }),
      );

    const event = listener.mock.lastCall?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    if (event instanceof CustomEvent) {
      expect(event.detail).toEqual({
        type: 'changes',
        changes: [{ path: ['menu', 'style'], type: 'set', value: 'outside' }],
      });
      // The editor is the only thing that listens, and it sits outside this
      // section's shadow root.
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    }
  });

  describe('should track whether it is open', () => {
    it('should start closed and never opened', () => {
      const { controller } = createController();
      expect(controller.isOpen()).toBe(false);
      expect(controller.wasEverOpened()).toBe(false);
    });

    it('should open and request an update', () => {
      const { host, controller } = createController();

      controller.setOpen(true);

      expect(controller.isOpen()).toBe(true);
      expect(controller.wasEverOpened()).toBe(true);
      expect(host.requestUpdate).toHaveBeenCalledTimes(1);
    });

    it('should remember having been opened after it closes', () => {
      const { controller } = createController();
      controller.setOpen(true);

      controller.setOpen(false);

      expect(controller.isOpen()).toBe(false);
      expect(controller.wasEverOpened()).toBe(true);
    });

    it('should ignore a state it is already in', () => {
      const { host, controller } = createController();
      controller.setOpen(true);

      controller.setOpen(true);

      expect(host.requestUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
