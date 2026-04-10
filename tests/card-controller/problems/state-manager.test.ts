import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ProblemStateManager } from '../../../src/card-controller/problems/state-manager';
import {
  Problem,
  ProblemDescription,
} from '../../../src/card-controller/problems/types';
import { createHASS } from '../../test-utils';

const createProblemDescription = (
  overrides?: Partial<ProblemDescription>,
): ProblemDescription => ({
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

describe('ProblemStateManager', () => {
  let mockConfigUpgrade: Problem;
  let mockLegacyResource: Problem;
  let mockMediaLoad: Problem;

  const createManager = (problems?: Problem[]): ProblemStateManager => {
    const manager = new ProblemStateManager();
    for (const problem of problems ?? [
      mockConfigUpgrade,
      mockLegacyResource,
      mockMediaLoad,
    ]) {
      manager.addProblem(problem);
    }
    return manager;
  };

  beforeEach(() => {
    vi.resetAllMocks();

    mockConfigUpgrade = mock<Problem>({ key: 'config_upgrade' });
    mockLegacyResource = mock<Problem>({ key: 'legacy_resource' });
    mockMediaLoad = mock<Problem>({ key: 'media_load' });
  });

  it('should register all provided problems on construction', () => {
    const manager = createManager();
    const presence = manager.getProblemPresence();

    expect(presence.has('config_upgrade')).toBe(false);
    expect(presence.has('legacy_resource')).toBe(false);
    expect(presence.has('media_load')).toBe(false);
  });

  describe('detectStatic', () => {
    it('should call detectStatic on all problems', async () => {
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
    it('should call trigger on the matching problem', () => {
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
    it('should call detectDynamic on problems with the given state', () => {
      const manager = createManager();

      manager.detectDynamic({ view: 'live' });

      assert(mockMediaLoad.detectDynamic);
      expect(mockMediaLoad.detectDynamic).toBeCalledWith({ view: 'live' });
    });
  });

  describe('getFullCardProblem', () => {
    it('should return first full-card problem', () => {
      const result = createProblemDescription();
      vi.mocked(mockMediaLoad.hasProblem).mockReturnValue(true);
      assert(mockMediaLoad.isFullCardProblem);
      vi.mocked(mockMediaLoad.isFullCardProblem).mockReturnValue(true);
      vi.mocked(mockMediaLoad.getProblem).mockReturnValue(result);

      const manager = createManager();

      expect(manager.getFullCardProblem()).toBe(result);
    });

    it('should return null when only popup problems exist', () => {
      vi.mocked(mockMediaLoad.hasProblem).mockReturnValue(true);
      assert(mockMediaLoad.isFullCardProblem);
      vi.mocked(mockMediaLoad.isFullCardProblem).mockReturnValue(false);

      const manager = createManager();

      expect(manager.getFullCardProblem()).toBeNull();
    });

    it('should skip inactive full-card problems', () => {
      vi.mocked(mockMediaLoad.hasProblem).mockReturnValue(false);

      const manager = createManager();

      expect(manager.getFullCardProblem()).toBeNull();
    });
  });

  describe('hasFullCardProblem', () => {
    it('should return true when full-card problem exists', () => {
      vi.mocked(mockMediaLoad.hasProblem).mockReturnValue(true);
      assert(mockMediaLoad.isFullCardProblem);
      vi.mocked(mockMediaLoad.isFullCardProblem).mockReturnValue(true);
      vi.mocked(mockMediaLoad.getProblem).mockReturnValue(createProblemDescription());

      expect(createManager().hasFullCardProblem()).toBe(true);
    });

    it('should return false when no full-card problems', () => {
      expect(createManager().hasFullCardProblem()).toBe(false);
    });
  });

  describe('getProblemDescriptions', () => {
    it('should return results for active problems', () => {
      const result = createProblemDescription();
      vi.mocked(mockConfigUpgrade.getProblem).mockReturnValue(result);

      const manager = createManager();

      expect(manager.getProblemDescriptions()).toEqual([
        { key: 'config_upgrade', problem: result },
      ]);
    });

    it('should return empty array when no problems active', () => {
      expect(createManager().getProblemDescriptions()).toEqual([]);
    });
  });

  describe('getProblemPresence', () => {
    it('should return presence map', () => {
      vi.mocked(mockConfigUpgrade.hasProblem).mockReturnValue(true);
      vi.mocked(mockLegacyResource.hasProblem).mockReturnValue(false);

      const manager = createManager();

      const presence = manager.getProblemPresence();
      expect(presence.has('config_upgrade')).toBe(true);
      expect(presence.has('legacy_resource')).toBe(false);
    });
  });

  describe('getNotification', () => {
    it('should return notification for a problem', () => {
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
    it('should call retry on problems that want retry with non-exclusive result', () => {
      assert(mockMediaLoad.needsRetry);
      assert(mockMediaLoad.retry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(true);
      vi.mocked(mockMediaLoad.retry).mockReturnValue(false);

      const manager = createManager();
      manager.retry();

      expect(mockMediaLoad.retry).toBeCalled();
    });

    it('should call retry on problems that want retry with exclusive result', () => {
      assert(mockMediaLoad.needsRetry);
      assert(mockMediaLoad.retry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(true);
      vi.mocked(mockMediaLoad.retry).mockReturnValue(true);

      createManager().retry();

      expect(mockMediaLoad.retry).toBeCalled();
    });

    it('should not call retry on problems that do not want retry', () => {
      assert(mockMediaLoad.needsRetry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(false);

      const manager = createManager();
      manager.retry();

      assert(mockMediaLoad.retry);
      expect(mockMediaLoad.retry).not.toBeCalled();
    });

    it('should stop after exclusive result and not call retry on subsequent problems', () => {
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

    it('should continue after non-exclusive result and call retry on subsequent problems', () => {
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
    it('should call retry on the matching problem when needsRetry is true', () => {
      assert(mockMediaLoad.needsRetry);
      assert(mockMediaLoad.retry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(true);
      vi.mocked(mockMediaLoad.retry).mockReturnValue(false);

      createManager().retry('media_load');

      expect(mockMediaLoad.retry).toBeCalled();
    });

    it('should not call retry on the matching problem when needsRetry is false', () => {
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
    it('should return true when problems want retry', () => {
      assert(mockMediaLoad.needsRetry);
      vi.mocked(mockMediaLoad.needsRetry).mockReturnValue(true);

      expect(createManager().needsRetry()).toBe(true);
    });

    it('should return false when no problems want retry', () => {
      expect(createManager().needsRetry()).toBe(false);
    });
  });

  describe('logging', () => {
    it('should log on static detection when problem is active', async () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      const result = createProblemDescription({
        notification: { body: { text: 'Legacy problem' } },
      });
      vi.mocked(mockLegacyResource.hasProblem).mockReturnValue(true);
      vi.mocked(mockLegacyResource.getProblem).mockReturnValue(result);

      const manager = createManager();
      await manager.detectStatic(createHASS());

      expect(spy).toBeCalledWith(
        'Advanced Camera Card: [problem=legacy_resource] Legacy problem',
      );
      spy.mockRestore();
    });

    it('should log on dynamic evaluation when problem becomes active', () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      const result = createProblemDescription({
        notification: { body: { text: 'Stream problem' } },
      });
      vi.mocked(mockMediaLoad.hasProblem)
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      vi.mocked(mockMediaLoad.getProblem).mockReturnValue(result);

      const manager = createManager();
      manager.detectDynamic({ view: 'live' });

      expect(spy).toBeCalledWith(
        'Advanced Camera Card: [problem=media_load] Stream problem',
      );
      spy.mockRestore();
    });

    it('should only log once per problem key', async () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      const result = createProblemDescription({
        notification: { body: { text: 'Repeated' } },
      });
      vi.mocked(mockLegacyResource.hasProblem).mockReturnValue(true);
      vi.mocked(mockLegacyResource.getProblem).mockReturnValue(result);

      const manager = createManager();
      await manager.detectStatic(createHASS());
      await manager.detectStatic(createHASS());

      expect(spy).toBeCalledTimes(1);
      spy.mockRestore();
    });

    it('should not log when problem has no result', async () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      vi.mocked(mockLegacyResource.hasProblem).mockReturnValue(false);

      const manager = createManager();
      await manager.detectStatic(createHASS());

      expect(spy).not.toBeCalled();
      spy.mockRestore();
    });

    it('should not log when problem result has no summarizable text', async () => {
      const spy = vi.spyOn(console, 'warn').mockReturnValue();
      // Notification has neither body.text nor heading.text
      const result = createProblemDescription({
        notification: {},
      });
      vi.mocked(mockLegacyResource.hasProblem).mockReturnValue(true);
      vi.mocked(mockLegacyResource.getProblem).mockReturnValue(result);

      const manager = createManager();
      await manager.detectStatic(createHASS());

      expect(spy).not.toBeCalled();
      spy.mockRestore();
    });
  });

  describe('reset', () => {
    it('should reset a specific problem by key', () => {
      const manager = createManager();
      manager.reset('media_load');

      assert(mockMediaLoad.reset);
      expect(mockMediaLoad.reset).toBeCalled();
      assert(mockConfigUpgrade.reset);
      expect(mockConfigUpgrade.reset).not.toBeCalled();
    });

    it('should reset all problems when no key is given', () => {
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

  describe('destroy', () => {
    it('should destroy all problems and clear', () => {
      const manager = createManager();
      manager.destroy();

      assert(mockConfigUpgrade.reset);
      assert(mockLegacyResource.reset);
      assert(mockMediaLoad.reset);
      expect(mockConfigUpgrade.reset).toBeCalled();
      expect(mockLegacyResource.reset).toBeCalled();
      expect(mockMediaLoad.reset).toBeCalled();
      expect(manager.getProblemPresence().size).toBe(0);
    });
  });
});
