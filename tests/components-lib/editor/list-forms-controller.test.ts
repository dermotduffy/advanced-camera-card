import { html } from 'lit';
import { assert, describe, expect, it, vi, type Mock } from 'vitest';

import { ListFormsController } from '../../../src/components-lib/editor/list-forms-controller';
import { createLitElement } from '../../test-utils';

const OPTIONS = { cameras: [], folders: [] };

const createController = () => {
  const host = createLitElement();
  const listener = vi.fn();
  host.addEventListener('advanced-camera-card:editor:intent', listener);
  return {
    host,
    listener,
    controller: new ListFormsController(host, () => html`doc`),
  };
};

const getLastIntent = (listener: Mock): unknown => {
  const event = listener.mock.lastCall?.[0];
  assert(event instanceof CustomEvent);
  return event.detail;
};

// @vitest-environment jsdom
describe('ListFormsController', () => {
  it('should register with the host', () => {
    const { host, controller } = createController();
    expect(host.addController).toHaveBeenCalledWith(controller);
    controller.hostConnected();
  });

  describe('should read a list', () => {
    it('should have no items before it is given any input', () => {
      const { controller } = createController();
      expect(controller.getList(['cameras'])).toEqual([]);
    });

    it('should read the items at a path', () => {
      const { controller } = createController();
      controller.setInput({
        config: { cameras: [{ id: 'one' }] },
        defaults: {},
        options: OPTIONS,
      });

      expect(controller.getList(['cameras'])).toEqual([{ id: 'one' }]);
    });

    it('should read a nested list', () => {
      const { controller } = createController();
      controller.setInput({
        config: { cameras: [{ triggers: { events: [{ event_type: 'a' }] } }] },
        defaults: {},
        options: OPTIONS,
      });

      expect(controller.getList(['cameras', 0, 'triggers', 'events'])).toEqual([
        { event_type: 'a' },
      ]);
    });

    it('should report an item that is not an object as an empty one', () => {
      const { controller } = createController();
      controller.setInput({
        config: { cameras: [{ id: 'one' }, 'junk'] },
        defaults: {},
        options: OPTIONS,
      });

      expect(controller.getList(['cameras'])).toEqual([{ id: 'one' }, {}]);
    });

    it('should report no items for a value that is not a list', () => {
      const { controller } = createController();
      controller.setInput({
        config: { cameras: 'junk' },
        defaults: {},
        options: OPTIONS,
      });

      expect(controller.getList(['cameras'])).toEqual([]);
    });
  });

  describe('should build the forms of an item', () => {
    it('should have no contexts before it is given any input', () => {
      const { controller } = createController();
      expect(controller.getFormContexts({ kind: 'full-camera', index: 0 })).toEqual([]);
    });

    it.each([
      [{ kind: 'full-camera' as const, index: 1 }, ['cameras', 1]],
      [{ kind: 'full-folder' as const, index: 2 }, ['folders', 2]],
      [
        { kind: 'full-camera-triggers' as const, cameraIndex: 1 },
        ['cameras', 1, 'triggers'],
      ],
      [
        { kind: 'full-camera-event' as const, cameraIndex: 1, eventIndex: 3 },
        ['cameras', 1, 'triggers', 'events', 3],
      ],
    ])('should build the forms for %j', (request, basePath) => {
      const { controller } = createController();
      controller.setInput({ config: {}, defaults: {}, options: OPTIONS });

      const contexts = controller.getFormContexts(request);
      expect(contexts).toHaveLength(1);
      expect(contexts[0].form.basePath).toEqual(basePath);
    });

    it('should keep the forms of an item across configuration changes', () => {
      const { controller } = createController();
      const request = { kind: 'full-camera' as const, index: 0 };
      controller.setInput({ config: {}, defaults: {}, options: OPTIONS });
      const before = controller.getFormContexts(request)[0].form;

      controller.setInput({
        config: { cameras: [{ id: 'one' }] },
        defaults: {},
        options: OPTIONS,
      });

      expect(controller.getFormContexts(request)[0].form).toBe(before);
    });

    it('should keep the same contexts when nothing changed', () => {
      const { controller } = createController();
      const request = { kind: 'full-camera' as const, index: 0 };
      const input = { config: {}, defaults: {}, options: OPTIONS };
      controller.setInput(input);
      const before = controller.getFormContexts(request);

      controller.setInput({ ...input });

      expect(controller.getFormContexts(request)).toBe(before);
    });

    it('should give each request its own contexts', () => {
      const { controller, listener } = createController();
      controller.setInput({ config: {}, defaults: {}, options: OPTIONS });

      const camera = controller.getFormContexts({ kind: 'full-camera', index: 0 });
      const folder = controller.getFormContexts({ kind: 'full-folder', index: 0 });
      expect(camera[0]).not.toBe(folder[0]);

      folder[0].valueChanged(
        new CustomEvent('value-changed', { detail: { value: { title: 'Clips' } } }),
      );

      // The edit is attributed to the folder, not to the camera of the same
      // index.
      expect(getLastIntent(listener)).toEqual({
        type: 'changes',
        changes: [{ path: ['folders', 0, 'title'], type: 'set', value: 'Clips' }],
      });
    });

    it('should rebuild the forms when the values its selectors offer change', () => {
      const { controller } = createController();
      const request = { kind: 'full-camera' as const, index: 0 };
      controller.setInput({ config: {}, defaults: {}, options: OPTIONS });
      const before = controller.getFormContexts(request)[0].form;

      controller.setInput({
        config: {},
        defaults: {},
        options: {
          ...OPTIONS,
          cameras: [
            { value: 'camera.one', label: 'One' },
            { value: 'camera.other', label: 'Other' },
          ],
        },
      });

      expect(controller.getFormContexts(request)[0].form).not.toBe(before);
    });

    it('should report an edit as an intent with an absolute path', () => {
      const { controller, listener } = createController();
      controller.setInput({ config: {}, defaults: {}, options: OPTIONS });

      controller
        .getFormContexts({ kind: 'full-camera', index: 2 })[0]
        .valueChanged(
          new CustomEvent('value-changed', { detail: { value: { id: 'front' } } }),
        );

      expect(getLastIntent(listener)).toEqual({
        type: 'changes',
        changes: [{ path: ['cameras', 2, 'id'], type: 'set', value: 'front' }],
      });
    });
  });

  describe('should report a list change as an intent', () => {
    it('should report an addition', () => {
      const { controller, listener } = createController();

      controller.addItem(['cameras'], { id: 'one' });

      expect(getLastIntent(listener)).toEqual({
        type: 'list-add',
        path: ['cameras'],
        item: { id: 'one' },
      });
    });

    it('should report a move', () => {
      const { controller, listener } = createController();

      controller.moveItem(['cameras'], 0, 1);

      expect(getLastIntent(listener)).toEqual({
        type: 'list-move',
        path: ['cameras'],
        from: 0,
        to: 1,
      });
    });

    it('should report a deletion', () => {
      const { controller, listener } = createController();

      controller.deleteItem(['cameras'], 1);

      expect(getLastIntent(listener)).toEqual({
        type: 'list-delete',
        path: ['cameras'],
        index: 1,
      });
    });
  });
});
