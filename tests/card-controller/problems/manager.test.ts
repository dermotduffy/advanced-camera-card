import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ProblemManager } from '../../../src/card-controller/problems/manager';
import { ConfigUpgradeProblem } from '../../../src/card-controller/problems/problems/config-upgrade';
import { LegacyResourceProblem } from '../../../src/card-controller/problems/problems/legacy-resource';
import { StreamNotLoadingProblem } from '../../../src/card-controller/problems/problems/stream-not-loading';
import { Problem, ProblemResult } from '../../../src/card-controller/problems/types';
import { ConditionStateManager } from '../../../src/conditions/state-manager';
import { createCardAPI, createHASS } from '../../test-utils';

vi.mock('../../../src/card-controller/problems/problems/config-upgrade');
vi.mock('../../../src/card-controller/problems/problems/legacy-resource');
vi.mock('../../../src/card-controller/problems/problems/stream-not-loading');

const createProblemResult = (overrides?: Partial<ProblemResult>): ProblemResult => ({
  icon: 'mdi:test',
  severity: 'high',
  notification: {
    heading: {
      text: 'Test heading',
      icon: 'mdi:test',
      severity: 'high',
    },
    text: 'Test text',
  },
  ...overrides,
});

// @vitest-environment jsdom
describe('ProblemManager', () => {
  let mockConfigUpgrade: Problem;
  let mockLegacyResource: Problem;
  let mockStreamNotLoading: Problem;

  beforeEach(() => {
    vi.resetAllMocks();

    mockConfigUpgrade = mock<Problem>({ key: 'config_upgrade' });
    mockLegacyResource = mock<Problem>({ key: 'legacy_resource' });
    mockStreamNotLoading = mock<Problem>({ key: 'stream_not_loading' });

    vi.mocked(ConfigUpgradeProblem).mockImplementation(
      () => mockConfigUpgrade as unknown as ConfigUpgradeProblem,
    );
    vi.mocked(LegacyResourceProblem).mockImplementation(
      () => mockLegacyResource as unknown as LegacyResourceProblem,
    );
    vi.mocked(StreamNotLoadingProblem).mockImplementation(
      () => mockStreamNotLoading as unknown as StreamNotLoadingProblem,
    );
  });

  it('should pass config getter to ConfigUpgradeProblem', () => {
    const api = createCardAPI();
    new ProblemManager(api);

    const callback = vi.mocked(ConfigUpgradeProblem).mock.calls[0][0];
    callback();

    expect(api.getConfigManager().getRawConfig).toBeCalled();
  });

  it('should pass update callback to LegacyResourceProblem', () => {
    const api = createCardAPI();
    new ProblemManager(api);

    const callback = vi.mocked(LegacyResourceProblem).mock.calls[0][0];
    callback();

    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should pass update callback to StreamNotLoadingProblem', () => {
    const api = createCardAPI();
    new ProblemManager(api);

    const callback = vi.mocked(StreamNotLoadingProblem).mock.calls[0][0];
    callback();

    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should register all built-in problems on construction', () => {
    const api = createCardAPI();
    const manager = new ProblemManager(api);
    const presence = manager.getProblemPresence();

    expect('config_upgrade' in presence).toBe(true);
    expect('legacy_resource' in presence).toBe(true);
    expect('stream_not_loading' in presence).toBe(true);
  });

  describe('detectStatic', () => {
    it('should call detectStatic on all problems', async () => {
      const api = createCardAPI();
      const manager = new ProblemManager(api);
      const hass = createHASS();

      await manager.detectStatic(hass);

      expect(mockConfigUpgrade.detectStatic).toBeCalledWith(hass);
      expect(mockLegacyResource.detectStatic).toBeCalledWith(hass);
      expect(mockStreamNotLoading.detectStatic).toBeCalledWith(hass);
      expect(api.getCardElementManager().update).toBeCalled();
    });
  });

  describe('trigger', () => {
    it('should trigger a problem and update when state changes', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      const manager = new ProblemManager(api);
      vi.mocked(mockStreamNotLoading.hasResult)
        .mockReturnValueOnce(false)
        .mockReturnValue(true);

      manager.trigger('stream_not_loading');

      expect(mockStreamNotLoading.trigger).toBeCalled();
      expect(api.getCardElementManager().update).toBeCalled();
    });

    it('should do nothing for unknown key', () => {
      const api = createCardAPI();
      const manager = new ProblemManager(api);

      manager.trigger(('stream_not_loading' + '_unknown') as never);

      expect(mockStreamNotLoading.trigger).not.toBeCalled();
    });

    it('should not update when trigger does not change state', () => {
      const api = createCardAPI();
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
      const manager = new ProblemManager(api);
      vi.mocked(mockStreamNotLoading.hasResult).mockReturnValue(false);

      manager.trigger('stream_not_loading');

      expect(mockStreamNotLoading.trigger).toBeCalled();
      expect(api.getCardElementManager().update).not.toBeCalled();
    });
  });

  describe('forceNotify', () => {
    it('should show notification from getNotification', () => {
      const api = createCardAPI();
      const manager = new ProblemManager(api);
      const notification = { text: 'from getNotification' };
      mockStreamNotLoading.getNotification = vi.fn().mockReturnValue(notification);

      manager.forceNotify('stream_not_loading');

      expect(api.getNotificationManager().setNotification).toBeCalledWith(notification);
    });

    it('should not show notification when getNotification returns null', () => {
      const api = createCardAPI();
      const manager = new ProblemManager(api);

      manager.forceNotify('config_upgrade');

      expect(api.getNotificationManager().setNotification).not.toBeCalled();
    });
  });

  describe('getProblemResults', () => {
    it('should return results for active problems', () => {
      const api = createCardAPI();
      const result = createProblemResult();
      vi.mocked(mockConfigUpgrade.getResult).mockReturnValue(result);

      const manager = new ProblemManager(api);

      expect(manager.getProblemResults()).toEqual([
        { key: 'config_upgrade', problem: result },
      ]);
    });

    it('should return empty array when no problems active', () => {
      const api = createCardAPI();
      const manager = new ProblemManager(api);

      expect(manager.getProblemResults()).toEqual([]);
    });
  });

  describe('getProblemPresence', () => {
    it('should return presence map', () => {
      const api = createCardAPI();
      vi.mocked(mockConfigUpgrade.hasResult).mockReturnValue(true);
      vi.mocked(mockLegacyResource.hasResult).mockReturnValue(false);

      const manager = new ProblemManager(api);

      expect(manager.getProblemPresence()).toMatchObject({
        ['config_upgrade']: true,
        ['legacy_resource']: false,
      });
    });
  });

  describe('state change handling', () => {
    it('should detect dynamic problems on view change', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new ProblemManager(api);
      vi.mocked(mockStreamNotLoading.hasResult)
        .mockReturnValueOnce(false)
        .mockReturnValue(true);

      manager.initialize();

      stateManager.setState({ view: 'live' });

      expect(mockStreamNotLoading.detectDynamic).toBeCalledWith({
        view: 'live',
        mediaLoaded: false,
      });
      expect(api.getCardElementManager().update).toBeCalled();
    });

    it('should detect dynamic problems on mediaLoadedInfo change', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new ProblemManager(api);

      manager.initialize();

      stateManager.setState({
        mediaLoadedInfo: { width: 1920, height: 1080 },
      });

      expect(mockStreamNotLoading.detectDynamic).toBeCalledWith(
        expect.objectContaining({ mediaLoaded: true }),
      );
    });

    it('should not update when dynamic detection does not change state', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new ProblemManager(api);
      vi.mocked(mockStreamNotLoading.hasResult).mockReturnValue(false);

      manager.initialize();

      stateManager.setState({ view: 'live' });

      expect(mockStreamNotLoading.detectDynamic).toBeCalled();
      expect(api.getCardElementManager().update).not.toBeCalled();
    });
  });

  describe('uninitialize', () => {
    it('should remove state listener', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new ProblemManager(api);

      manager.initialize();
      manager.uninitialize();

      stateManager.setState({ view: 'live' });

      expect(mockStreamNotLoading.detectDynamic).not.toBeCalled();
    });
  });

  describe('destroy', () => {
    it('should destroy all problems and clear', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const manager = new ProblemManager(api);

      manager.initialize();
      manager.destroy();

      expect(mockConfigUpgrade.destroy).toBeCalled();
      expect(mockLegacyResource.destroy).toBeCalled();
      expect(mockStreamNotLoading.destroy).toBeCalled();
      expect(manager.getProblemPresence()).toEqual({});

      // State changes after destroy should not trigger detection.
      stateManager.setState({ view: 'live' });

      expect(mockStreamNotLoading.detectDynamic).not.toBeCalled();
    });
  });
});
