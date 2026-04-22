import { assert, describe, expect, it } from 'vitest';
import {
  createNotificationFromError,
  createNotificationFromText,
} from '../../../src/components-lib/notification/factory';
import { AdvancedCameraCardError } from '../../../src/types';

describe('createNotificationFromText', () => {
  it('should create a notification with body text', () => {
    const notification = createNotificationFromText('Something failed');
    expect(notification.body?.text).toBe('Something failed');
  });

  it('should add the default error icon to body when no heading and no icon provided', () => {
    const notification = createNotificationFromText('oops');
    expect(notification.body?.icon).toBe('mdi:alert');
  });

  it('should add a custom icon to body when specified', () => {
    const notification = createNotificationFromText('oops', { icon: 'mdi:wifi-off' });
    expect(notification.body?.icon).toBe('mdi:wifi-off');
  });

  it('should include the heading when provided', () => {
    const notification = createNotificationFromText('oops', {
      heading: { text: 'Error heading' },
    });
    expect(notification.heading?.text).toBe('Error heading');
  });

  it('should omit icon from body when heading is provided and no icon is specified', () => {
    const notification = createNotificationFromText('oops', {
      heading: { text: 'Error heading' },
    });
    expect(notification.body?.icon).toBeUndefined();
  });

  it('should add icon to body when heading is provided but icon is also specified', () => {
    const notification = createNotificationFromText('oops', {
      heading: { text: 'Error heading' },
      icon: 'mdi:alert-circle',
    });
    expect(notification.body?.icon).toBe('mdi:alert-circle');
  });

  it('should include metadata when provided', () => {
    const notification = createNotificationFromText('oops', {
      metadata: [{ text: 'meta line' }],
    });
    expect(notification.metadata).toEqual([{ text: 'meta line' }]);
  });

  it('should omit metadata when not provided', () => {
    const notification = createNotificationFromText('oops');
    expect(notification.metadata).toBeUndefined();
  });

  it('should include link when provided', () => {
    const notification = createNotificationFromText('oops', {
      link: { url: 'https://example.com', title: 'Docs' },
    });
    expect(notification.link?.url).toBe('https://example.com');
  });

  it('should include context when provided', () => {
    const notification = createNotificationFromText('oops', {
      context: { detail: 'extra info' },
    });
    expect(notification.context).toBeDefined();
    expect(notification.context?.join(' ')).toContain('detail: extra info');
  });

  it('should omit context when not provided', () => {
    const notification = createNotificationFromText('oops');
    expect(notification.context).toBeUndefined();
  });

  it('should include in_progress when true', () => {
    const notification = createNotificationFromText('oops', { in_progress: true });
    expect(notification.in_progress).toBe(true);
  });

  it('should include in_progress when false', () => {
    const notification = createNotificationFromText('oops', { in_progress: false });
    expect(notification.in_progress).toBe(false);
  });

  it('should omit in_progress when not provided', () => {
    const notification = createNotificationFromText('oops');
    expect(notification.in_progress).toBeUndefined();
  });
});

describe('createNotificationFromError', () => {
  it('should create a notification from an Error object', () => {
    const notification = createNotificationFromError(new Error('something failed'));
    assert(notification);
    expect(notification.body?.text).toBe('something failed');
  });

  it('should create a notification from a string error', () => {
    const notification = createNotificationFromError('plain string error');
    assert(notification);
    expect(notification.body?.text).toBe('plain string error');
  });

  it('should create a notification from a non-error object', () => {
    const notification = createNotificationFromError({ code: 404 });
    assert(notification);
    expect(notification.body?.text).toBe('{"code":404}');
  });

  it('should merge the default error icon into heading when heading is provided', () => {
    const notification = createNotificationFromError(new Error('failed'), {
      heading: { text: 'Init Error' },
    });
    assert(notification);
    expect(notification.heading?.text).toBe('Init Error');
    expect(notification.heading?.icon).toBe('mdi:alert');
    expect(notification.heading?.severity).toBe('high');
  });

  it('should preserve custom heading properties alongside defaults', () => {
    const notification = createNotificationFromError(new Error('failed'), {
      heading: { text: 'My Heading', icon: 'mdi:custom', severity: 'medium' },
    });
    assert(notification);
    // Spread order: { icon: DEFAULT, severity: 'high', ...options.heading }
    // so custom values win
    expect(notification.heading?.icon).toBe('mdi:custom');
    expect(notification.heading?.severity).toBe('medium');
  });

  it('should use context from AdvancedCameraCardError when no explicit context is provided', () => {
    const error = new AdvancedCameraCardError('boom', { reason: 'network' });
    const notification = createNotificationFromError(error);
    assert(notification);
    expect(notification.context).toBeDefined();
    expect(notification.context?.join(' ')).toContain('reason: network');
  });

  it('should use explicit context option over AdvancedCameraCardError context', () => {
    const error = new AdvancedCameraCardError('boom', { reason: 'network' });
    const notification = createNotificationFromError(error, {
      context: { override: 'explicit' },
    });
    assert(notification);
    expect(notification.context?.join(' ')).toContain('override: explicit');
    expect(notification.context?.join(' ')).not.toContain('reason: network');
  });

  it('should not include context when AdvancedCameraCardError has a non-object context', () => {
    const error = new AdvancedCameraCardError('boom', 'not an object');
    const notification = createNotificationFromError(error);
    assert(notification);
    expect(notification.context).toBeUndefined();
  });

  it('should not include context when AdvancedCameraCardError context is null', () => {
    const error = new AdvancedCameraCardError('boom', null);
    const notification = createNotificationFromError(error);
    assert(notification);
    expect(notification.context).toBeUndefined();
  });

});
