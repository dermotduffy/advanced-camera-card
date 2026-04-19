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

  it('should track media info by camera without overwriting the selected media', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);
    const selectedMedia = createMediaLoadedInfo();
    const otherMedia = createMediaLoadedInfo({ width: 200, height: 200 });

    manager.set(selectedMedia, { cameraID: 'camera-1' });
    manager.set(otherMedia, { cameraID: 'camera-2', selectCurrent: false });

    expect(manager.get()).toBe(selectedMedia);
    expect(manager.get('camera-1')).toBe(selectedMedia);
    expect(manager.get('camera-2')).toBe(otherMedia);
    expect(manager.getLastKnown('camera-2')).toBe(otherMedia);

    manager.clear({ cameraID: 'camera-2' });

    expect(manager.get()).toBe(selectedMedia);
    expect(manager.get('camera-2')).toBeNull();
  });

  it('should clear the selected media when clearing the selected camera', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);
    const mediaLoadedInfo = createMediaLoadedInfo();

    manager.set(mediaLoadedInfo, { cameraID: 'camera-1' });
    manager.clear({ cameraID: 'camera-1' });

    expect(manager.get()).toBeNull();
    expect(manager.get('camera-1')).toBeNull();
    expect(manager.getLastKnown('camera-1')).toBe(mediaLoadedInfo);
    expect(api.getConditionStateManager().setState).toBeCalledWith({
      mediaLoadedInfo: null,
    });
  });

  it('should clear all current media without losing last known media', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);
    const selectedMedia = createMediaLoadedInfo();
    const otherMedia = createMediaLoadedInfo({ width: 300, height: 300 });

    manager.set(selectedMedia, { cameraID: 'camera-1' });
    manager.set(otherMedia, { cameraID: 'camera-2', selectCurrent: false });

    manager.clear({ all: true });

    expect(manager.get()).toBeNull();
    expect(manager.get('camera-1')).toBeNull();
    expect(manager.get('camera-2')).toBeNull();
    expect(manager.getLastKnown()).toBe(selectedMedia);
    expect(manager.getLastKnown('camera-2')).toBe(otherMedia);
    expect(api.getConditionStateManager().setState).toBeCalledWith({
      mediaLoadedInfo: null,
    });
  });

  it('should return null for unknown last-known camera media and ignore clearing unknown cameras', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);

    expect(manager.getLastKnown('unknown-camera')).toBeNull();

    manager.clear({ cameraID: 'unknown-camera' });

    expect(api.getConditionStateManager().setState).not.toBeCalled();
  });
});
