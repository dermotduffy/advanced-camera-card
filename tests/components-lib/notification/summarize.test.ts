import { describe, expect, it } from 'vitest';
import { summarizeNotification } from '../../../src/components-lib/notification/summarize';
import { Notification } from '../../../src/config/schema/actions/types';

describe('summarizeNotification', () => {
  it('should return the body text when present', () => {
    const notification: Notification = { body: { text: 'Body text' } };
    expect(summarizeNotification(notification)).toBe('Body text');
  });

  it('should return the heading text when body is absent', () => {
    const notification: Notification = {
      heading: { text: 'Heading text' },
    };
    expect(summarizeNotification(notification)).toBe('Heading text');
  });

  it('should return the body text even when heading is also present', () => {
    const notification: Notification = {
      heading: { text: 'Heading text' },
      body: { text: 'Body text' },
    };
    expect(summarizeNotification(notification)).toBe('Body text');
  });

  it('should return null when neither body nor heading has text', () => {
    const notification: Notification = {};
    expect(summarizeNotification(notification)).toBeNull();
  });

  it('should append metadata text in brackets', () => {
    const notification: Notification = {
      body: { text: 'Media not loading' },
      metadata: [{ text: 'camera.office' }, { text: 'camera.garden' }],
    };
    expect(summarizeNotification(notification)).toBe(
      'Media not loading [camera.office, camera.garden]',
    );
  });

  it('should not append brackets when metadata is empty', () => {
    const notification: Notification = {
      body: { text: 'Body text' },
      metadata: [],
    };
    expect(summarizeNotification(notification)).toBe('Body text');
  });
});
