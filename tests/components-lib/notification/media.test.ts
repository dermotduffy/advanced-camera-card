import { describe, expect, it } from 'vitest';

import { createMediaNotification } from '../../../src/components-lib/notification/media';

describe('createMediaNotification', () => {
  it('should put the title and icon in the heading', () => {
    const notification = createMediaNotification({
      icon: 'mdi:alert-circle',
      title: 'Streaming server error',
    });
    expect(notification.heading).toEqual({
      icon: 'mdi:alert-circle',
      text: 'Streaming server error',
    });
  });

  it('should default the icon to a generic alert icon', () => {
    const notification = createMediaNotification({
      title: 'Streaming server error',
    });
    expect(notification.heading?.icon).toBe('mdi:alert-circle');
  });

  it('should append the camera title to the heading', () => {
    const notification = createMediaNotification({
      icon: 'mdi:alert-circle',
      title: 'Streaming server error',
      targetTitle: 'Front Door',
    });
    expect(notification.heading?.text).toBe('Streaming server error: Front Door');
  });

  it('should show the detail as the body', () => {
    const notification = createMediaNotification({
      icon: 'mdi:alert-circle',
      title: 'Configuration error',
      detail: 'No endpoint',
    });
    expect(notification.body?.text).toBe('No endpoint');
  });

  it('should omit the body without a detail', () => {
    const notification = createMediaNotification({
      icon: 'mdi:alert-circle',
      title: 'X',
    });
    expect(notification.body).toBeUndefined();
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
