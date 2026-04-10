import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegacyResourceProblem } from '../../../../src/card-controller/problems/problems/legacy-resource';
import { HomeAssistant } from '../../../../src/ha/types';
import { createCardAPI, createHASS, createUser } from '../../../test-utils';

const setupHASSResources = (
  hass: HomeAssistant,
  resources: { id: string; type: string; url: string }[],
): void => {
  vi.mocked(hass.hassUrl).mockReturnValue('http://homeassistant.local:8123');
  vi.mocked(hass.callWS).mockResolvedValue(resources);
};

describe('LegacyResourceProblem', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should have correct key', () => {
    const problem = new LegacyResourceProblem();
    expect(problem.key).toBe('legacy_resource');
  });

  describe('detectStatic', () => {
    it('should skip non-admin users', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: false }));

      await problem.detectStatic(hass);

      expect(problem.hasProblem()).toBe(false);
    });

    it('should detect legacy resource regardless of directory', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      setupHASSResources(hass, [
        {
          id: '1',
          type: 'module',
          url: '/some/arbitrary/path/frigate-hass-card.js?v=1',
        },
      ]);

      await problem.detectStatic(hass);

      expect(problem.hasProblem()).toBe(true);
    });

    it('should not detect when only advanced-camera-card exists', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      setupHASSResources(hass, [
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
        },
      ]);

      await problem.detectStatic(hass);

      expect(problem.hasProblem()).toBe(false);
    });

    it('should handle invalid resource data', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      vi.mocked(hass.callWS).mockResolvedValue('not-an-array');

      await problem.detectStatic(hass);

      expect(problem.hasProblem()).toBe(false);
    });

    it('should handle websocket failure', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      vi.mocked(hass.callWS).mockRejectedValue(new Error('connection lost'));

      await problem.detectStatic(hass);

      expect(problem.hasProblem()).toBe(false);
    });

    it('should handle missing user', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS();
      Object.defineProperty(hass, 'user', { value: undefined });

      await problem.detectStatic(hass);

      expect(problem.hasProblem()).toBe(false);
    });
  });

  describe('getProblem', () => {
    it('should return controls and link when both resources exist', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      setupHASSResources(hass, [
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js',
        },
        {
          id: '2',
          type: 'module',
          url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
        },
      ]);

      await problem.detectStatic(hass);

      const result = problem.getProblem();
      expect(result).not.toBeNull();
      expect(result?.notification.controls).toHaveLength(1);
      expect(result?.notification.link).toBeDefined();
    });

    it('should return link without controls when only legacy exists', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      setupHASSResources(hass, [
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js',
        },
      ]);

      await problem.detectStatic(hass);

      const result = problem.getProblem();
      expect(result).not.toBeNull();
      expect(result?.notification.link).toBeDefined();
      expect(result?.notification.controls).toBeUndefined();
    });

    it('should return null when no result', () => {
      const problem = new LegacyResourceProblem();
      expect(problem.getProblem()).toBeNull();
    });
  });

  describe('fix', () => {
    it('should remove legacy resources when correct resource exists', async () => {
      const onChange = vi.fn();
      const problem = new LegacyResourceProblem(onChange);
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      vi.mocked(hass.hassUrl).mockReturnValue('http://homeassistant.local:8123');

      vi.mocked(hass.callWS).mockResolvedValueOnce([
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js',
        },
        {
          id: '2',
          type: 'module',
          url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
        },
      ]);
      await problem.detectStatic(hass);

      vi.mocked(hass.callWS)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([
          {
            id: '2',
            type: 'module',
            url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
          },
        ]);

      const result = await problem.fix(hass);

      expect(result).toBe(true);
      expect(hass.callWS).toBeCalledWith(
        expect.objectContaining({
          type: 'lovelace/resources/delete',
          resource_id: '1',
        }),
      );
      expect(problem.hasProblem()).toBe(false);
      expect(onChange).toBeCalled();
    });

    it('should not fix when only legacy resource exists', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      setupHASSResources(hass, [
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js',
        },
      ]);

      await problem.detectStatic(hass);

      const result = await problem.fix(hass);
      expect(result).toBe(false);
    });

    it('should not fix for non-admin', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: false }));

      const result = await problem.fix(hass);
      expect(result).toBe(false);
    });

    it('should return false on websocket failure during fix', async () => {
      const onChange = vi.fn();
      const problem = new LegacyResourceProblem(onChange);
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      vi.mocked(hass.hassUrl).mockReturnValue('http://homeassistant.local:8123');
      vi.mocked(hass.callWS).mockResolvedValueOnce([
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js',
        },
        {
          id: '2',
          type: 'module',
          url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
        },
      ]);

      await problem.detectStatic(hass);

      vi.mocked(hass.callWS).mockRejectedValue(new Error('connection lost'));

      const result = await problem.fix(hass);
      expect(result).toBe(false);
      expect(onChange).not.toBeCalled();
    });

    it('should return false when re-detection still finds legacy resource', async () => {
      const onChange = vi.fn();
      const problem = new LegacyResourceProblem(onChange);
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      vi.mocked(hass.hassUrl).mockReturnValue('http://homeassistant.local:8123');

      vi.mocked(hass.callWS).mockResolvedValueOnce([
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js',
        },
        {
          id: '2',
          type: 'module',
          url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
        },
      ]);
      await problem.detectStatic(hass);

      // Delete succeeds, but re-detection still finds the legacy resource.
      vi.mocked(hass.callWS)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([
          {
            id: '1',
            type: 'module',
            url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js',
          },
          {
            id: '2',
            type: 'module',
            url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
          },
        ]);

      const result = await problem.fix(hass);

      expect(result).toBe(false);
      expect(onChange).not.toBeCalled();
    });

    it('should fix multiple legacy resources', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      vi.mocked(hass.hassUrl).mockReturnValue('http://homeassistant.local:8123');
      vi.mocked(hass.callWS).mockResolvedValueOnce([
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js',
        },
        { id: '3', type: 'module', url: '/local/frigate-hass-card.js' },
        {
          id: '2',
          type: 'module',
          url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
        },
      ]);

      await problem.detectStatic(hass);

      vi.mocked(hass.callWS)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([
          {
            id: '2',
            type: 'module',
            url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
          },
        ]);

      expect(await problem.fix(hass)).toBe(true);
    });
  });

  describe('getResourcePath fallback', () => {
    it('should handle invalid URLs by stripping query string', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      vi.mocked(hass.hassUrl).mockReturnValue('not-a-valid-url');
      vi.mocked(hass.callWS).mockResolvedValue([
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js?v=1',
        },
      ]);

      await problem.detectStatic(hass);

      expect(problem.hasProblem()).toBe(true);
    });

    it('should handle invalid URLs without query string', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      vi.mocked(hass.hassUrl).mockReturnValue('not-a-valid-url');
      vi.mocked(hass.callWS).mockResolvedValue([
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js',
        },
      ]);

      await problem.detectStatic(hass);

      expect(problem.hasProblem()).toBe(true);
    });
  });

  describe('callback action', () => {
    const getCallback = (
      problem: LegacyResourceProblem,
    ): ((api: unknown) => Promise<void>) | null => {
      const result = problem.getProblem();
      const action = result?.notification.controls?.[0]?.actions?.tap_action;
      if (action && 'callback' in action) {
        return (action as { callback: (api: unknown) => Promise<void> }).callback;
      }
      return null;
    };

    it('should call fix via the notification control action', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      vi.mocked(hass.hassUrl).mockReturnValue('http://homeassistant.local:8123');
      vi.mocked(hass.callWS).mockResolvedValueOnce([
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js',
        },
        {
          id: '2',
          type: 'module',
          url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
        },
      ]);

      await problem.detectStatic(hass);

      const callback = getCallback(problem);
      expect(callback).toBeDefined();

      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      vi.mocked(hass.callWS)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([
          {
            id: '2',
            type: 'module',
            url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
          },
        ]);

      await callback?.(api);

      expect(hass.callWS).toBeCalledWith(
        expect.objectContaining({
          type: 'lovelace/resources/delete',
        }),
      );
    });

    it('should handle missing hass in callback', async () => {
      const problem = new LegacyResourceProblem();
      const hass = createHASS(undefined, createUser({ is_admin: true }));
      vi.mocked(hass.hassUrl).mockReturnValue('http://homeassistant.local:8123');
      vi.mocked(hass.callWS).mockResolvedValueOnce([
        {
          id: '1',
          type: 'module',
          url: '/hacsfiles/frigate-hass-card/frigate-hass-card.js',
        },
        {
          id: '2',
          type: 'module',
          url: '/hacsfiles/advanced-camera-card/advanced-camera-card.js',
        },
      ]);

      await problem.detectStatic(hass);

      const callback = getCallback(problem);
      expect(callback).toBeDefined();

      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);

      await callback?.(api);
    });
  });
});
