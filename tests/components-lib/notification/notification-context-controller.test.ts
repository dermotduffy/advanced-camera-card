import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Notification } from '../../../src/config/schema/actions/types';
import { createLitElement, flushPromises } from '../../test-utils';

// @vitest-environment jsdom
describe('NotificationContextController', () => {
  // Each test re-imports the controller after resetting the module registry so its
  // module-level `js-yaml` singleton starts unloaded.
  const loadController = async () => {
    const module = await import(
      '../../../src/components-lib/notification/notification-context-controller'
    );
    return module.NotificationContextController;
  };

  const createNotification = (context?: Notification['context']): Notification => ({
    body: { text: 'oops' },
    ...(context && { context }),
  });

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('js-yaml');
  });

  it('should return an empty array when the notification has no context', async () => {
    const NotificationContextController = await loadController();
    const controller = new NotificationContextController(createLitElement());

    expect(controller.getContext(createNotification())).toEqual([]);
  });

  it('should return string context items unchanged without loading the library', async () => {
    const NotificationContextController = await loadController();
    const host = createLitElement();
    const controller = new NotificationContextController(host);

    expect(controller.getContext(createNotification(['line one', 'line two']))).toEqual([
      'line one',
      'line two',
    ]);
    expect(host.requestUpdate).not.toHaveBeenCalled();
  });

  it('should YAML-dump object context items once the library has loaded', async () => {
    const NotificationContextController = await loadController();
    const host = createLitElement();
    const controller = new NotificationContextController(host);
    const notification = createNotification([{ foo: 'bar' }]);

    // The library is not yet loaded, so the first render defers.
    expect(controller.getContext(notification)).toEqual([]);

    await vi.waitFor(() => expect(host.requestUpdate).toHaveBeenCalled());

    const result = controller.getContext(notification);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('foo: bar');
  });

  it('should defer the whole context until the library loads when any item is an object', async () => {
    const NotificationContextController = await loadController();
    const host = createLitElement();
    const controller = new NotificationContextController(host);
    const notification = createNotification(['plain string', { foo: 'bar' }]);

    expect(controller.getContext(notification)).toEqual([]);

    await vi.waitFor(() => expect(host.requestUpdate).toHaveBeenCalled());

    const result = controller.getContext(notification);
    expect(result[0]).toBe('plain string');
    expect(result[1]).toContain('foo: bar');
  });

  it('should swallow a failed library load and render without the dumped context', async () => {
    vi.doMock('js-yaml', () => {
      throw new Error('chunk load failed');
    });
    const NotificationContextController = await loadController();
    const host = createLitElement();
    const controller = new NotificationContextController(host);
    const notification = createNotification([{ foo: 'bar' }]);

    expect(controller.getContext(notification)).toEqual([]);

    // Allow the rejected dynamic import to settle.
    await flushPromises();

    expect(host.requestUpdate).not.toHaveBeenCalled();
    expect(controller.getContext(notification)).toEqual([]);
  });
});
