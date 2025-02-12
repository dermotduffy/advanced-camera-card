import { describe, expect, it } from 'vitest';
import { MediaLoadedInfoManager } from '../../src/card-controller/media-info-manager';
import { createCardAPI, createMediaLoadedInfo } from '../test-utils.js';

describe('MediaLoadedInfoManager', () => {
  it('should initialize', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);

    manager.initialize();
    expect(api.getConditionStateManager().setState).toBeCalledWith({
      mediaLoadedInfo: null,
    });
  });

  it('should set', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);
    const mediaInfo = createMediaLoadedInfo();

    manager.set(mediaInfo);

    expect(manager.has()).toBeTruthy();
    expect(manager.get()).toBe(mediaInfo);
    expect(api.getConditionStateManager().setState).toBeCalledWith(
      expect.objectContaining({ mediaLoadedInfo: mediaInfo }),
    );
    expect(api.getStyleManager().setExpandedMode).toBeCalled();
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should not set invalid media info', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);
    const mediaLoadedInfo = createMediaLoadedInfo({ width: 0, height: 0 });

    manager.set(mediaLoadedInfo);

    expect(manager.has()).toBeFalsy();
    expect(manager.get()).toBeNull();
    expect(api.getConditionStateManager().setState).not.toBeCalled();
  });

  it('should get last known', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);
    const mediaLoadedInfo = createMediaLoadedInfo();

    manager.set(mediaLoadedInfo);

    expect(manager.has()).toBeTruthy();

    manager.clear();

    expect(manager.has()).toBeFalsy();
    expect(manager.getLastKnown()).toBe(mediaLoadedInfo);
    expect(api.getConditionStateManager().setState).toBeCalledWith(
      expect.objectContaining({ mediaLoadedInfo }),
    );
  });
});
