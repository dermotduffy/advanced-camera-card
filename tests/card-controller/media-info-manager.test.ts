import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaLoadedInfoManager } from '../../src/card-controller/media-info-manager';
import {
  createCardAPI,
  createMediaLoadedInfo,
  createMediaLoadedInfoEvent,
} from '../test-utils.js';

// @vitest-environment jsdom
describe('MediaLoadedInfoManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);

    manager.initialize();

    expect(api.getConditionStateManager().setState).toBeCalledWith({
      mediaLoadedInfo: null,
    });
  });

  describe('set', () => {
    it('should surface info and fire condition state for the selected target', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const owner = document.createElement('div');
      const info = createMediaLoadedInfo({ targetID: 'target-1' });

      manager.setSelected('target-1');
      vi.clearAllMocks();
      manager.set(info, owner);

      expect(manager.has()).toBeTruthy();
      expect(manager.get()).toBe(info);
      expect(api.getConditionStateManager().setState).toBeCalledWith({
        mediaLoadedInfo: info,
      });
      expect(api.getStyleManager().setExpandedMode).toBeCalled();
      expect(api.getCardElementManager().update).toBeCalled();
    });

    it('should cache info for non-selected targets without side effects', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const owner = document.createElement('div');
      const info = createMediaLoadedInfo({ targetID: 'target-1' });

      manager.set(info, owner);

      expect(manager.has()).toBeFalsy();
      expect(manager.get()).toBeNull();
      expect(api.getConditionStateManager().setState).not.toBeCalled();
      expect(api.getStyleManager().setExpandedMode).not.toBeCalled();
      expect(api.getCardElementManager().update).not.toBeCalled();

      manager.setSelected('target-1');

      expect(manager.has()).toBeTruthy();
      expect(manager.get()).toBe(info);
      expect(api.getConditionStateManager().setState).toBeCalledWith({
        mediaLoadedInfo: info,
      });
    });

    it('should reject info missing dimensions', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const owner = document.createElement('div');
      const info = createMediaLoadedInfo({
        width: 0,
        height: 0,
        targetID: 'target-1',
      });

      manager.setSelected('target-1');
      vi.clearAllMocks();
      manager.set(info, owner);

      expect(manager.has()).toBeFalsy();
      expect(manager.get()).toBeNull();
      expect(api.getConditionStateManager().setState).not.toBeCalled();
      expect(api.getStyleManager().setExpandedMode).not.toBeCalled();
      expect(api.getCardElementManager().update).not.toBeCalled();
    });

    it('should reject info without a targetID', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const owner = document.createElement('div');
      const info = createMediaLoadedInfo({ targetID: undefined });

      manager.setSelected('target-1');
      manager.set(info, owner);

      expect(manager.has()).toBeFalsy();
    });
  });

  describe('setSelected', () => {
    it('should switch between targets', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const owner1 = document.createElement('div');
      const owner2 = document.createElement('div');
      const info1 = createMediaLoadedInfo({ targetID: 'target-1' });
      const info2 = createMediaLoadedInfo({ targetID: 'target-2' });

      manager.set(info1, owner1);
      manager.set(info2, owner2);

      manager.setSelected('target-1');
      expect(manager.get()).toBe(info1);

      manager.setSelected('target-2');
      expect(manager.get()).toBe(info2);

      manager.setSelected(null);
      expect(manager.get()).toBeNull();
    });

    it('should be a no-op when re-selecting the same target', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);

      manager.setSelected('target-1');
      vi.clearAllMocks();
      manager.setSelected('target-1');

      expect(api.getConditionStateManager().setState).not.toBeCalled();
    });

    it('should emit null condition state when selecting a target with no info', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);

      manager.setSelected('target-1');

      expect(api.getConditionStateManager().setState).toBeCalledWith({
        mediaLoadedInfo: null,
      });
    });
  });

  describe('getLastKnown', () => {
    it('should return the last known info for the selected target', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const owner = document.createElement('div');
      const info = createMediaLoadedInfo({ targetID: 'target-1' });

      manager.setSelected('target-1');
      manager.set(info, owner);

      expect(manager.getLastKnown()).toBe(info);
    });

    it('should return null when nothing is selected', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);

      expect(manager.getLastKnown()).toBeNull();
    });

    it('should preserve last known across clear', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const owner = document.createElement('div');
      const info = createMediaLoadedInfo({ targetID: 'target-1' });

      manager.setSelected('target-1');
      manager.set(info, owner);
      manager.clear();

      expect(manager.has()).toBeFalsy();
      expect(manager.getLastKnown()).toBe(info);
    });
  });

  describe('handleLoadEvent', () => {
    it('should register info from a valid event', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const source = document.createElement('div');
      const ac = new AbortController();
      const info = createMediaLoadedInfo({ targetID: 'target-1' });

      manager.setSelected('target-1');
      vi.clearAllMocks();
      manager.handleLoadEvent(
        createMediaLoadedInfoEvent({ source, info, signal: ac.signal }),
      );

      expect(manager.get()).toBe(info);
      expect(api.getConditionStateManager().setState).toBeCalledWith({
        mediaLoadedInfo: info,
      });
    });

    it('should ignore events whose composedPath()[0] is not an HTMLElement', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const ac = new AbortController();
      const info = createMediaLoadedInfo({ targetID: 'target-1' });
      const ev = createMediaLoadedInfoEvent({ info, signal: ac.signal });
      // Force the path to look like a non-HTMLElement (e.g. a window).
      Object.defineProperty(ev, 'composedPath', { value: () => [window] });

      manager.setSelected('target-1');
      manager.handleLoadEvent(ev);

      expect(manager.has()).toBeFalsy();
    });

    it('should ignore events whose info has no targetID', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const source = document.createElement('div');
      const ac = new AbortController();
      const info = createMediaLoadedInfo({ targetID: undefined });

      manager.setSelected('target-1');
      manager.handleLoadEvent(
        createMediaLoadedInfoEvent({ source, info, signal: ac.signal }),
      );

      expect(manager.has()).toBeFalsy();
    });

    it('should clear an entry on signal abort', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const source = document.createElement('div');
      const ac = new AbortController();
      const info = createMediaLoadedInfo({ targetID: 'target-1' });

      manager.setSelected('target-1');
      manager.handleLoadEvent(
        createMediaLoadedInfoEvent({ source, info, signal: ac.signal }),
      );
      expect(manager.has()).toBeTruthy();

      ac.abort();

      expect(manager.has()).toBeFalsy();
      expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith({
        mediaLoadedInfo: null,
      });
    });

    it('should not clear an entry whose owner has been replaced when an older signal aborts', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);

      const owner1 = document.createElement('div');
      const owner2 = document.createElement('div');
      const ac1 = new AbortController();
      const ac2 = new AbortController();
      const info1 = createMediaLoadedInfo({ targetID: 'target-1' });
      const info2 = createMediaLoadedInfo({ targetID: 'target-1' });

      manager.setSelected('target-1');
      manager.handleLoadEvent(
        createMediaLoadedInfoEvent({ source: owner1, info: info1, signal: ac1.signal }),
      );
      manager.handleLoadEvent(
        createMediaLoadedInfoEvent({ source: owner2, info: info2, signal: ac2.signal }),
      );

      expect(manager.get()).toBe(info2);

      // The first owner's signal aborts, but it shouldn't blow away the entry
      // owner2 has since taken over.
      ac1.abort();

      expect(manager.get()).toBe(info2);
    });

    it('should not fire condition state when clearing a non-selected target', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const source = document.createElement('div');
      const ac = new AbortController();
      const info = createMediaLoadedInfo({ targetID: 'target-1' });

      // Select a different target than the one being cleared.
      manager.setSelected('target-other');
      manager.handleLoadEvent(
        createMediaLoadedInfoEvent({ source, info, signal: ac.signal }),
      );
      vi.clearAllMocks();

      ac.abort();

      expect(api.getConditionStateManager().setState).not.toBeCalled();
    });
  });

  describe('clear', () => {
    it('should drop active entries and fire condition state when selected target had info', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const owner = document.createElement('div');
      const info = createMediaLoadedInfo({ targetID: 'target-1' });

      manager.setSelected('target-1');
      manager.set(info, owner);
      vi.clearAllMocks();

      manager.clear();

      expect(manager.has()).toBeFalsy();
      expect(api.getConditionStateManager().setState).toBeCalledWith({
        mediaLoadedInfo: null,
      });
    });

    it('should be a no-op on condition state when nothing is selected', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);

      manager.clear();

      expect(api.getConditionStateManager().setState).not.toBeCalled();
    });

    it('should not fire condition state when the selected target has no info', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);

      manager.setSelected('target-1');
      vi.clearAllMocks();
      manager.clear();

      expect(api.getConditionStateManager().setState).not.toBeCalled();
    });
  });

  describe('initialize', () => {
    it('should clear active state, last-known and selected', () => {
      const api = createCardAPI();
      const manager = new MediaLoadedInfoManager(api);
      const owner = document.createElement('div');
      const info = createMediaLoadedInfo({ targetID: 'target-1' });

      manager.setSelected('target-1');
      manager.set(info, owner);

      manager.initialize();

      expect(manager.get()).toBeNull();
      expect(manager.getLastKnown()).toBeNull();

      // Re-selecting `target-1` after initialize should produce no last-known.
      manager.setSelected('target-1');
      expect(manager.getLastKnown()).toBeNull();
    });
  });
});
