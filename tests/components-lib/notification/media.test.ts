import { describe, expect, it } from 'vitest';

import { createMediaNotification } from '../../../src/components-lib/notification/media';

describe('createMediaNotification', () => {
  it('should put the title in the body when there is no detail', () => {
    const notification = createMediaNotification({
      icon: 'mdi:alert-circle',
      title: 'Streaming server error',
    });
    expect(notification.body).toEqual({
      icon: 'mdi:alert-circle',
      text: 'Streaming server error',
    });
    expect(notification.heading).toBeUndefined();
  });

  it('should default the icon to a generic alert icon', () => {
    const notification = createMediaNotification({
      title: 'Streaming server error',
    });
    expect(notification.body?.icon).toBe('mdi:alert-circle');
  });

  it('should omit the icon when it is null', () => {
    const notification = createMediaNotification({
      icon: null,
      title: 'Awaiting live view',
    });
    expect(notification.body?.icon).toBeUndefined();
  });

  it('should append the target title to the text', () => {
    const notification = createMediaNotification({
      icon: 'mdi:alert-circle',
      title: 'Streaming server error',
      targetTitle: 'Front Door',
    });
    expect(notification.body?.text).toBe('Streaming server error: Front Door');
  });

  it('should use a heading when detail is present', () => {
    const notification = createMediaNotification({
      icon: 'mdi:alert-circle',
      title: 'Configuration error',
      detail: 'No endpoint',
    });
    expect(notification.heading).toEqual({
      icon: 'mdi:alert-circle',
      text: 'Configuration error',
    });
    expect(notification.body?.text).toBe('No endpoint');
  });

  it('should use a heading with target title when detail is present', () => {
    const notification = createMediaNotification({
      icon: 'mdi:camera',
      title: 'Configuration error',
      targetTitle: 'Front Door',
      detail: 'No endpoint',
    });
    expect(notification.heading?.text).toBe('Configuration error: Front Door');
    expect(notification.body?.text).toBe('No endpoint');
  });

  it('should include the troubleshooting link', () => {
    const notification = createMediaNotification({
      icon: 'mdi:alert-circle',
      title: 'X',
    });
    expect(notification.link?.title).toBe('Check troubleshooting');
    expect(notification.link?.url).toBeTruthy();
  });

  it('should omit the troubleshooting link when troubleshooting is false', () => {
    const notification = createMediaNotification({
      icon: 'mdi:alert-circle',
      title: 'X',
      troubleshooting: false,
    });
    expect(notification.link).toBeUndefined();
  });

  it('should show a spinner by default', () => {
    const notification = createMediaNotification({
      icon: 'mdi:alert-circle',
      title: 'X',
    });
    expect(notification.in_progress).toBe(true);
  });

  it('should omit the spinner when not retrying', () => {
    const notification = createMediaNotification({
      icon: 'mdi:alert-circle',
      title: 'X',
      inProgress: false,
    });
    expect(notification.in_progress).toBeUndefined();
  });
});
