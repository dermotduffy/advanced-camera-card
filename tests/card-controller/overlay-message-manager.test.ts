import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CardElementManager } from '../../src/card-controller/card-element-manager';
import { OverlayMessageManager } from '../../src/card-controller/overlay-message-manager';
import { CardOverlayMessageAPI } from '../../src/card-controller/types';

describe('OverlayMessageManager', () => {
  const cardElementManager = mock<CardElementManager>();
  const api = mock<CardOverlayMessageAPI>();

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCardElementManager.mockReturnValue(cardElementManager);
  });

  it('should be constructed', () => {
    const manager = new OverlayMessageManager(api);
    expect(manager).toBeDefined();
    expect(manager.getMessage()).toBeNull();
    expect(manager.hasMessage()).toBeFalsy();
  });

  it('should set and get message', () => {
    const manager = new OverlayMessageManager(api);
    const message = { message: 'foo' };
    manager.setMessage(message);

    expect(manager.getMessage()).toBe(message);
    expect(manager.hasMessage()).toBeTruthy();
    expect(cardElementManager.update).toHaveBeenCalled();
  });

  it('should reset message', () => {
    const manager = new OverlayMessageManager(api);
    manager.setMessage({ message: 'foo' });
    vi.clearAllMocks();

    manager.reset();

    expect(manager.getMessage()).toBeNull();
    expect(manager.hasMessage()).toBeFalsy();
    expect(cardElementManager.update).toHaveBeenCalled();
  });

  it('should not update if reset is called with no message', () => {
    const manager = new OverlayMessageManager(api);
    manager.reset();

    expect(cardElementManager.update).not.toHaveBeenCalled();
  });
});
