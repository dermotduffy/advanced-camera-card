import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { IssueStateManager } from '../../../src/card-controller/issues/state-manager';
import { Issue, IssueDescription } from '../../../src/card-controller/issues/types';
import { createHASS } from '../../test-utils';

const createIssueDescription = (
  overrides?: Partial<IssueDescription>,
): IssueDescription => ({
  icon: 'mdi:test',
  severity: 'high',
  notification: {
    heading: {
      text: 'Test heading',
      icon: 'mdi:test',
      severity: 'high',
    },
    body: { text: 'Test text' },
  },
  ...overrides,
});

describe('IssueStateManager', () => {
  let mockConfigUpgrade: Issue;
  let mockLegacyResource: Issue;
  let mockMediaLoad: Issue;

  const createManager = (issues?: Issue[]): IssueStateManager => {
    const manager = new IssueStateManager();
    for (const issue of issues ?? [
      mockConfigUpgrade,
      mockLegacyResource,
      mockMediaLoad,
    ]) {
      manager.addIssue(issue);
    }
    return manager;
  };

  beforeEach(() => {
    vi.resetAllMocks();

    mockConfigUpgrade = mock<Issue>({ key: 'config_upgrade' });
    mockLegacyResource = mock<Issue>({ key: 'legacy_resource' });
    mockMediaLoad = mock<Issue>({ key: 'media_load' });
  });

  it('should register all provided issues on construction', () => {
    const manager = createManager();
    const presence = manager.getIssuePresence();

    expect(presence.has('config_upgrade')).toBe(false);
    expect(presence.has('legacy_resource')).toBe(false);
    expect(presence.has('media_load')).toBe(false);
  });

  describe('detectStatic', () => {
    it('should call detectStatic on all issues', async () => {
      const manager = createManager();
      const hass = createHASS();

      await manager.detectStatic(hass);

      assert(mockConfigUpgrade.detectStatic);
      assert(mockLegacyResource.detectStatic);
      assert(mockMediaLoad.detectStatic);
      expect(mockConfigUpgrade.detectStatic).toBeCalledWith(hass);
      expect(mockLegacyResource.detectStatic).toBeCalledWith(hass);
      expect(mockMediaLoad.detectStatic).toBeCalledWith(hass);
    });
  });

  describe('trigger', () => {
    it('should call trigger on the matching issue', () => {
      const manager = createManager();

      manager.trigger('media_load', { targetID: 'cam1' });

      assert(mockMediaLoad.trigger);
      expect(mockMediaLoad.trigger).toBeCalledWith({ targetID: 'cam1' });
    });

    it('should do nothing for unknown key', () => {
      const manager = createManager();

      manager.trigger('unknown' as never, {} as never);

      assert(mockMediaLoad.trigger);
      expect(mockMediaLoad.trigger).not.toBeCalled();
    });
  });

  describe('detectDynamic', () => {
    it('should call detectDynamic on issues with the given state', () => {
      const manager = createManager();

      manager.detectDynamic({ view: 'live' });

      assert(mockMediaLoad.detectDynamic);
      expect(mockMediaLoad.detectDynamic).toBeCalledWith({ view: 'live' });
    });
  });

  describe('getFullCardIssue', () => {
    it('should return first full-card issue', () => {
      const result = createIssueDescription();
      vi.mocked(mockMediaLoad.hasIssue).mockReturnValue(true);
      assert(mockMediaLoad.isFullCardIssue);
      vi.mocked(mockMediaLoad.isFullCardIssue).mockReturnValue(true);
      vi.mocked(mockMediaLoad.getIssue).mockReturnValue(result);

      const manager = createManager();

      expect(manager.getFullCardIssue()).toBe(result);
    });

    it('should return null when only popup issues exist', () => {
      vi.mocked(mockMediaLoad.hasIssue).mockReturnValue(true);
      assert(mockMediaLoad.isFullCardIssue);
      vi.mocked(mockMediaLoad.isFullCardIssue).mockReturnValue(false);

      const manager = createManager();

      expect(manager.getFullCardIssue()).toBeNull();
    });

    it('should skip inactive full-card issues', () => {
      vi.mocked(mockMediaLoad.hasIssue).mockReturnValue(false);

      const manager = createManager();

      expect(manager.getFullCardIssue()).toBeNull();
    });
  });

  describe('hasFullCardIssue', () => {
    it('should return true when full-card issue exists', () => {
      vi.mocked(mockMediaLoad.hasIssue).mockReturnValue(true);
      assert(mockMediaLoad.isFullCardIssue);
      vi.mocked(mockMediaLoad.isFullCardIssue).mockReturnValue(true);
      vi.mocked(mockMediaLoad.getIssue).mockReturnValue(createIssueDescription());

      expect(createManager().hasFullCardIssue()).toBe(true);
    });

    it('should return false when no full-card issues', () => {
      expect(createManager().hasFullCardIssue()).toBe(false);
    });
  });

  describe('isFullCardIssue', () => {
    it('should return true when the issue reports full-card', () => {
      assert(mockMediaLoad.isFullCardIssue);
      vi.mocked(mockMediaLoad.isFullCardIssue).mockReturnValue(true);

      expect(createManager().isFullCardIssue('media_load')).toBe(true);
    });

    it('should return false when the issue reports non-full-card', () => {
      assert(mockMediaLoad.isFullCardIssue);
      vi.mocked(mockMediaLoad.isFullCardIssue).mockReturnValue(false);

      expect(createManager().isFullCardIssue('media_load')).toBe(false);
    });

    it('should return false when the issue has no isFullCardIssue method', () => {
      const plain: Issue = {
        key: 'media_load',
        hasIssue: () => false,
        getIssue: () => null,
      };

      expect(createManager([plain]).isFullCardIssue('media_load')).toBe(false);
    });

    it('should return false for unknown key', () => {
      expect(createManager().isFullCardIssue('config_error')).toBe(false);
    });
  });

  describe('getIssueDescriptions', () => {
    it('should return results for active issues', () => {
      const result = createIssueDescription();
      vi.mocked(mockConfigUpgrade.getIssue).mockReturnValue(result);

      const manager = createManager();

      expect(manager.getIssueDescriptions()).toEqual([
        { key: 'config_upgrade', issue: result },
      ]);
    });

    it('should return empty array when no issues active', () => {
      expect(createManager().getIssueDescriptions()).toEqual([]);
    });
  });

  describe('getIssuePresence', () => {
    it('should return a map keyed by issue key with the current description as value', () => {
      const description = createIssueDescription();
      vi.mocked(mockConfigUpgrade.getIssue).mockReturnValue(description);
      vi.mocked(mockLegacyResource.getIssue).mockReturnValue(null);

      const manager = createManager();

      const presence = manager.getIssuePresence();
      expect(presence.has('config_upgrade')).toBe(true);
      expect(presence.get('config_upgrade')).toBe(description);
      expect(presence.has('legacy_resource')).toBe(false);
    });
  });

  describe('getNotification', () => {
    it('should return notification for an issue', () => {
      const notification = { body: { text: 'test' } };
      mockMediaLoad.getNotification = vi.fn().mockReturnValue(notification);

      const manager = createManager();

      expect(manager.getNotification('media_load')).toBe(notification);
    });

    it('should return null for unknown key', () => {
      expect(createManager().getNotification('unknown' as never)).toBeNull();
    });
  });

  describe('retry', () => {
    it('should call retry on issues that want retry with non-exclusive result', () => {
      assert(mockMediaLoad.needsRetry);
      assert(mockMediaLoad.retry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(true);
      vi.mocked(mockMediaLoad.retry).mockReturnValue(false);

      const manager = createManager();
      manager.retry();

      expect(mockMediaLoad.retry).toBeCalled();
    });

    it('should call retry on issues that want retry with exclusive result', () => {
      assert(mockMediaLoad.needsRetry);
      assert(mockMediaLoad.retry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(true);
      vi.mocked(mockMediaLoad.retry).mockReturnValue(true);

      createManager().retry();

      expect(mockMediaLoad.retry).toBeCalled();
    });

    it('should not call retry on issues that do not want retry', () => {
      assert(mockMediaLoad.needsRetry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(false);

      const manager = createManager();
      manager.retry();

      assert(mockMediaLoad.retry);
      expect(mockMediaLoad.retry).not.toBeCalled();
    });

    it('should stop after exclusive result and not call retry on subsequent issues', () => {
      // configUpgrade returns exclusive (true) → loop should stop.
      // mediaLoad is registered after, so its retry should not be called.
      assert(mockConfigUpgrade.needsRetry);
      assert(mockConfigUpgrade.retry);
      vi.mocked(mockConfigUpgrade.needsRetry).mockReturnValue(true);
      vi.mocked(mockConfigUpgrade.retry).mockReturnValue(true);
      assert(mockMediaLoad.needsRetry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(true);

      const manager = createManager();
      manager.retry();

      expect(mockConfigUpgrade.retry).toBeCalled();
      assert(mockMediaLoad.retry);
      expect(mockMediaLoad.retry).not.toBeCalled();
    });

    it('should continue after non-exclusive result and call retry on subsequent issues', () => {
      // configUpgrade returns non-exclusive (false) → loop should continue.
      assert(mockConfigUpgrade.needsRetry);
      assert(mockConfigUpgrade.retry);
      vi.mocked(mockConfigUpgrade.needsRetry).mockReturnValue(true);
      vi.mocked(mockConfigUpgrade.retry).mockReturnValue(false);
      assert(mockMediaLoad.needsRetry);
      assert(mockMediaLoad.retry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(true);
      vi.mocked(mockMediaLoad.retry).mockReturnValue(false);

      const manager = createManager();
      manager.retry();

      expect(mockConfigUpgrade.retry).toBeCalled();
      expect(mockMediaLoad.retry).toBeCalled();
    });
  });

  describe('retry with key', () => {
    it('should call retry on the matching issue when needsRetry is true', () => {
      assert(mockMediaLoad.needsRetry);
      assert(mockMediaLoad.retry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(true);
      vi.mocked(mockMediaLoad.retry).mockReturnValue(false);

      createManager().retry('media_load');

      expect(mockMediaLoad.retry).toBeCalled();
    });

    it('should not call retry on the matching issue when needsRetry is false', () => {
      assert(mockMediaLoad.needsRetry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(false);

      createManager().retry('media_load');

      assert(mockMediaLoad.retry);
      expect(mockMediaLoad.retry).not.toBeCalled();
    });

    it('should call retry when force is true even if needsRetry is false', () => {
      assert(mockMediaLoad.needsRetry);
      assert(mockMediaLoad.retry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(false);
      vi.mocked(mockMediaLoad.retry).mockReturnValue(false);

      createManager().retry('media_load', true);

      expect(mockMediaLoad.retry).toBeCalled();
    });

    it('should do nothing for unknown key', () => {
      createManager().retry('unknown' as never);

      assert(mockMediaLoad.retry);
      expect(mockMediaLoad.retry).not.toBeCalled();
    });
  });

  describe('needsRetry', () => {
    it('should return true when issues want retry', () => {
      assert(mockMediaLoad.needsRetry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(true);

      expect(createManager().needsRetry()).toBe(true);
    });

    it('should return false when no issues want retry', () => {
      expect(createManager().needsRetry()).toBe(false);
    });
  });

  describe('logging', () => {
    it('should log on static detection when issue is active', async () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      const result = createIssueDescription({
        notification: { body: { text: 'Legacy issue' } },
      });
      vi.mocked(mockLegacyResource.hasIssue).mockReturnValue(true);
      vi.mocked(mockLegacyResource.getIssue).mockReturnValue(result);

      const manager = createManager();
      await manager.detectStatic(createHASS());

      expect(spy).toBeCalledWith(
        'Advanced Camera Card [issue=legacy_resource]: Legacy issue',
      );
      spy.mockRestore();
    });

    it('should log on dynamic evaluation when issue becomes active', () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      const result = createIssueDescription({
        notification: { body: { text: 'Stream issue' } },
      });
      vi.mocked(mockMediaLoad.hasIssue).mockReturnValueOnce(false).mockReturnValue(true);
      vi.mocked(mockMediaLoad.getIssue).mockReturnValue(result);

      const manager = createManager();
      manager.detectDynamic({ view: 'live' });

      expect(spy).toBeCalledWith(
        'Advanced Camera Card [issue=media_load]: Stream issue',
      );
      spy.mockRestore();
    });

    it('should log on trigger when the issue becomes active', () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      const result = createIssueDescription({
        notification: { body: { text: 'Triggered' } },
      });
      vi.mocked(mockMediaLoad.getIssue).mockReturnValue(result);

      const manager = createManager();
      manager.trigger('media_load', { targetID: 'cam1' });

      expect(spy).toBeCalledWith('Advanced Camera Card [issue=media_load]: Triggered');
      spy.mockRestore();
    });

    it('should not log on trigger when the issue stays inactive', () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      vi.mocked(mockMediaLoad.getIssue).mockReturnValue(null);

      const manager = createManager();
      manager.trigger('media_load', { targetID: 'cam1' });

      expect(spy).not.toBeCalled();
      spy.mockRestore();
    });

    it('should not log on trigger for an unknown key', () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();

      const manager = createManager();
      manager.trigger('unknown' as never, {} as never);

      expect(spy).not.toBeCalled();
      spy.mockRestore();
    });

    it('should only log once per issue key', async () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      const result = createIssueDescription({
        notification: { body: { text: 'Repeated' } },
      });
      vi.mocked(mockLegacyResource.hasIssue).mockReturnValue(true);
      vi.mocked(mockLegacyResource.getIssue).mockReturnValue(result);

      const manager = createManager();
      await manager.detectStatic(createHASS());
      await manager.detectStatic(createHASS());

      expect(spy).toBeCalledTimes(1);
      spy.mockRestore();
    });

    it('should not log when issue has no result', async () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      vi.mocked(mockLegacyResource.hasIssue).mockReturnValue(false);

      const manager = createManager();
      await manager.detectStatic(createHASS());

      expect(spy).not.toBeCalled();
      spy.mockRestore();
    });

    it('should not log when issue result has no summarizable text', async () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      // Notification has neither body.text nor heading.text
      const result = createIssueDescription({
        notification: {},
      });
      vi.mocked(mockLegacyResource.hasIssue).mockReturnValue(true);
      vi.mocked(mockLegacyResource.getIssue).mockReturnValue(result);

      const manager = createManager();
      await manager.detectStatic(createHASS());

      expect(spy).not.toBeCalled();
      spy.mockRestore();
    });

    it('should log again after the issue clears and re-activates', async () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      const first = createIssueDescription({
        notification: { body: { text: 'First' } },
      });
      const second = createIssueDescription({
        notification: { body: { text: 'Second' } },
      });
      vi.mocked(mockLegacyResource.getIssue)
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(second);

      const manager = createManager();
      // Activate → log First.
      await manager.detectStatic(createHASS());
      // Clear → drop dedupe entry.
      await manager.detectStatic(createHASS());
      // Re-activate with a different payload → log Second.
      await manager.detectStatic(createHASS());

      expect(spy).toBeCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(
        1,
        'Advanced Camera Card [issue=legacy_resource]: First',
      );
      expect(spy).toHaveBeenNthCalledWith(
        2,
        'Advanced Camera Card [issue=legacy_resource]: Second',
      );
      spy.mockRestore();
    });

    it('should log again after reset and re-activation', () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      const description = createIssueDescription({
        notification: { body: { text: 'Repeat' } },
      });
      // Active → cleared-by-reset → active again on next eval.
      vi.mocked(mockMediaLoad.getIssue)
        .mockReturnValueOnce(description)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(description);

      const manager = createManager();
      manager.detectDynamic({ view: 'live' });
      manager.reset('media_load');
      // After reset, the issue reports cleared on next detect, releasing the
      // dedupe.
      manager.detectDynamic({ view: 'live' });
      // Then it re-activates (e.g. new trigger arrives).
      manager.detectDynamic({ view: 'live' });

      expect(spy).toBeCalledTimes(2);
      spy.mockRestore();
    });
  });

  describe('reset', () => {
    it('should reset a specific issue by key', () => {
      const manager = createManager();
      manager.reset('media_load');

      assert(mockMediaLoad.reset);
      expect(mockMediaLoad.reset).toBeCalled();
      assert(mockConfigUpgrade.reset);
      expect(mockConfigUpgrade.reset).not.toBeCalled();
    });

    it('should reset all issues when no key is given', () => {
      const manager = createManager();
      manager.reset();

      assert(mockConfigUpgrade.reset);
      assert(mockLegacyResource.reset);
      assert(mockMediaLoad.reset);
      expect(mockConfigUpgrade.reset).toBeCalled();
      expect(mockLegacyResource.reset).toBeCalled();
      expect(mockMediaLoad.reset).toBeCalled();
    });

    it('should do nothing for unknown key', () => {
      const manager = createManager();
      manager.reset('unknown' as never);

      assert(mockMediaLoad.reset);
      expect(mockMediaLoad.reset).not.toBeCalled();
    });
  });

  describe('suspend', () => {
    it('should call suspend on all issues that implement it', () => {
      const manager = createManager();
      manager.suspend();

      assert(mockConfigUpgrade.suspend);
      assert(mockLegacyResource.suspend);
      assert(mockMediaLoad.suspend);
      expect(mockConfigUpgrade.suspend).toBeCalled();
      expect(mockLegacyResource.suspend).toBeCalled();
      expect(mockMediaLoad.suspend).toBeCalled();
    });
  });

  describe('destroy', () => {
    it('should destroy all issues and clear', () => {
      const manager = createManager();
      manager.destroy();

      assert(mockConfigUpgrade.reset);
      assert(mockLegacyResource.reset);
      assert(mockMediaLoad.reset);
      expect(mockConfigUpgrade.reset).toBeCalled();
      expect(mockLegacyResource.reset).toBeCalled();
      expect(mockMediaLoad.reset).toBeCalled();
      expect(manager.getIssuePresence().size).toBe(0);
    });
  });
});
