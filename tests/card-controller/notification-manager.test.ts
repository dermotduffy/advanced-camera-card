import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CardElementManager } from '../../src/card-controller/card-element-manager';
import { NotificationManager } from '../../src/card-controller/notification-manager';
import { CardNotificationAPI } from '../../src/card-controller/types';

describe('NotificationManager', () => {
  const cardElementManager = mock<CardElementManager>();
  const api = mock<CardNotificationAPI>();

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCardElementManager.mockReturnValue(cardElementManager);
  });

  it('should be constructed', () => {
    const manager = new NotificationManager(api);
    expect(manager).toBeDefined();
    expect(manager.getNotification()).toBeNull();
    expect(manager.hasNotification()).toBeFalsy();
  });

  it('should set and get notification', () => {
    const manager = new NotificationManager(api);
    const notification = { body: { text: 'foo' } };
    manager.setNotification(notification);

    expect(manager.getNotification()).toBe(notification);
    expect(manager.hasNotification()).toBeTruthy();
    expect(cardElementManager.update).toHaveBeenCalled();
  });

  it('should reset notification', () => {
    const manager = new NotificationManager(api);
    manager.setNotification({ body: { text: 'foo' } });
    vi.clearAllMocks();

    manager.reset();

    expect(manager.getNotification()).toBeNull();
    expect(manager.hasNotification()).toBeFalsy();
    expect(cardElementManager.update).toHaveBeenCalled();
  });

  it('should not update if reset is called with no notification', () => {
    const manager = new NotificationManager(api);
    manager.reset();

    expect(cardElementManager.update).not.toHaveBeenCalled();
  });
});
