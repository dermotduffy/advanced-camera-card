import { html } from 'lit';
import { assert, describe, expect, it, vi, type Mock } from 'vitest';

import { KeyboardShortcutsController } from '../../../src/components-lib/editor/keyboard-shortcuts-controller';
import { configDefaults } from '../../../src/config/schema/types';
import { PTZ_KEYBOARD_SHORTCUTS } from '../../../src/config/schema/view';
import { createLitElement } from '../../test-utils';

const OPTIONS = { cameras: [], folders: [] };

const createController = () => {
  const host = createLitElement();
  const listener = vi.fn();
  host.addEventListener('advanced-camera-card:editor:intent', listener);
  return {
    host,
    listener,
    controller: new KeyboardShortcutsController(host, () => html`doc`),
  };
};

const getLastIntent = (listener: Mock): unknown => {
  const event = listener.mock.lastCall?.[0];
  assert(event instanceof CustomEvent);
  return event.detail;
};

// @vitest-environment jsdom
describe('KeyboardShortcutsController', () => {
  it('should register with the host', () => {
    const { host, controller } = createController();
    expect(host.addController).toHaveBeenCalledWith(controller);
    controller.hostConnected();
  });

  describe('should resolve the shortcuts', () => {
    it('should have every shortcut, in order, before it is given any input', () => {
      const { controller } = createController();
      expect(Object.keys(controller.getShortcuts())).toEqual([
        ...PTZ_KEYBOARD_SHORTCUTS,
      ]);
    });

    it('should resolve a shortcut the configuration leaves unset to its default', () => {
      const { controller } = createController();
      controller.setInput({ config: {}, defaults: configDefaults, options: OPTIONS });

      expect(controller.getShortcuts()['ptz_left']).toEqual(
        configDefaults.view.keyboard_shortcuts.ptz_left,
      );
    });

    it('should resolve a configured shortcut', () => {
      const { controller } = createController();
      controller.setInput({
        config: { view: { keyboard_shortcuts: { ptz_home: { key: 'k', ctrl: true } } } },
        defaults: configDefaults,
        options: OPTIONS,
      });

      expect(controller.getShortcuts()['ptz_home']).toEqual({ key: 'k', ctrl: true });
    });
  });

  describe('should report an assignment', () => {
    it('should report a shortcut as an intent', () => {
      const { controller, listener } = createController();
      controller.setInput({ config: {}, defaults: configDefaults, options: OPTIONS });

      controller.setShortcut('ptz_home', { key: 'k' });

      expect(getLastIntent(listener)).toEqual({
        type: 'changes',
        changes: [
          {
            path: ['view', 'keyboard_shortcuts', 'ptz_home'],
            type: 'set',
            value: { key: 'k' },
          },
        ],
      });
    });

    it('should record an unassignment rather than deleting the shortcut', () => {
      const { controller, listener } = createController();
      controller.setInput({ config: {}, defaults: configDefaults, options: OPTIONS });

      controller.setShortcut('ptz_home', null);

      expect(getLastIntent(listener)).toEqual({
        type: 'changes',
        changes: [
          { path: ['view', 'keyboard_shortcuts', 'ptz_home'], type: 'set', value: null },
        ],
      });
    });
  });

  describe('should offer the panel its own form', () => {
    it('should have no forms before it is given any input', () => {
      const { controller } = createController();
      expect(controller.getContexts()).toEqual([]);
    });

    it('should build the shortcuts form', () => {
      const { controller } = createController();
      controller.setInput({ config: {}, defaults: configDefaults, options: OPTIONS });

      const contexts = controller.getContexts();
      expect(contexts).toHaveLength(1);
      expect(contexts[0].form.basePath).toEqual(['view', 'keyboard_shortcuts']);
    });

    it('should report an edit to that form as an intent', () => {
      const { controller, listener } = createController();
      controller.setInput({ config: {}, defaults: configDefaults, options: OPTIONS });

      controller
        .getContexts()[0]
        .valueChanged(
          new CustomEvent('value-changed', { detail: { value: { enabled: false } } }),
        );

      expect(getLastIntent(listener)).toEqual({
        type: 'changes',
        changes: [
          { path: ['view', 'keyboard_shortcuts', 'enabled'], type: 'set', value: false },
        ],
      });
    });
  });
});
