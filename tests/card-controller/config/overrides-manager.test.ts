import { describe, expect, it, vi } from 'vitest';
import { OverridesManager } from '../../../src/card-controller/config/overrides-manager';
import { ConditionStateManager } from '../../../src/conditions/state-manager';
import { createConfig } from '../../test-utils';

describe('OverridesManager', () => {
  it('should add overrides', () => {
    const config = createConfig({
      overrides: [
        {
          set: {
            'menu.style': 'overlay',
          },
          conditions: [
            {
              condition: 'fullscreen' as const,
              fullscreen: true,
            },
          ],
        },
      ],
    });

    const manager = new OverridesManager(vi.fn());
    manager.set(new ConditionStateManager(), config.overrides);

    expect(manager.hasOverrides()).toBe(true);
  });

  it('should clear overrides', () => {
    const config = createConfig({
      overrides: [
        {
          set: {
            'menu.style': 'overlay',
          },
          conditions: [
            {
              condition: 'fullscreen' as const,
              fullscreen: true,
            },
          ],
        },
      ],
    });

    const stateManager = new ConditionStateManager();
    const manager = new OverridesManager(vi.fn());
    manager.set(stateManager, config.overrides);

    expect(manager.getConfig(config).menu?.style).toBe('hidden');

    manager.set(stateManager, []);

    stateManager.setState({ fullscreen: true });
    expect(manager.getConfig(config).menu?.style).toBe('hidden');

    expect(manager.hasOverrides()).toBe(false);
  });

  it('should not override when conditions do not match', () => {
    const config = createConfig({
      overrides: [
        {
          set: {
            'menu.style': 'overlay',
          },
          conditions: [
            {
              condition: 'fullscreen' as const,
              fullscreen: true,
            },
          ],
        },
      ],
    });

    const manager = new OverridesManager(vi.fn());
    manager.set(new ConditionStateManager(), config.overrides);

    expect(manager.getConfig(config)).toBe(config);
  });

  it('should callback on change', () => {
    const config = createConfig({
      overrides: [
        {
          set: {
            'menu.style': 'overlay',
          },
          conditions: [
            {
              condition: 'fullscreen' as const,
              fullscreen: true,
            },
          ],
        },
      ],
    });

    const callback = vi.fn();
    const stateManager = new ConditionStateManager();
    const manager = new OverridesManager(callback);
    manager.set(stateManager, config.overrides);

    expect(manager.getConfig(config).menu?.style).toBe('hidden');

    expect(callback).not.toBeCalled();

    stateManager.setState({ fullscreen: true });

    expect(callback).toBeCalledTimes(1);
  });

  describe('should handle override merge', () => {
    it('with path', () => {
      const config = createConfig({
        overrides: [
          {
            merge: {
              'live.controls.thumbnails': {
                mode: 'none',
              },
            },
            conditions: [
              {
                condition: 'fullscreen' as const,
                fullscreen: true,
              },
            ],
          },
        ],
      });

      const stateManager = new ConditionStateManager();
      stateManager.setState({ fullscreen: true });

      const manager = new OverridesManager(vi.fn());
      manager.set(stateManager, config.overrides);

      const overriddenConfig = manager.getConfig(config);

      expect(config.live.controls.thumbnails.mode).toBe('right');
      expect(overriddenConfig.live.controls.thumbnails.mode).toBe('none');
    });

    it('without path', () => {
      const config = createConfig({
        overrides: [
          {
            merge: {
              live: {
                controls: {
                  thumbnails: {
                    mode: 'none',
                  },
                },
              },
            },
            conditions: [
              {
                condition: 'fullscreen' as const,
                fullscreen: true,
              },
            ],
          },
        ],
      });

      const stateManager = new ConditionStateManager();
      stateManager.setState({ fullscreen: true });

      const manager = new OverridesManager(vi.fn());
      manager.set(stateManager, config.overrides);

      const overriddenConfig = manager.getConfig(config);

      expect(config.live.controls.thumbnails.mode).toBe('right');
      expect(overriddenConfig.live.controls.thumbnails.mode).toBe('none');
    });
  });

  describe('should handle override set', () => {
    it('leaf node', () => {
      const config = createConfig({
        overrides: [
          {
            set: {
              'live.controls.thumbnails.mode': 'none',
            },
            conditions: [
              {
                condition: 'fullscreen' as const,
                fullscreen: true,
              },
            ],
          },
        ],
      });

      const stateManager = new ConditionStateManager();
      stateManager.setState({ fullscreen: true });

      const manager = new OverridesManager(vi.fn());
      manager.set(stateManager, config.overrides);

      const overriddenConfig = manager.getConfig(config);

      expect(config.live.controls.thumbnails.mode).toBe('right');
      expect(overriddenConfig.live.controls.thumbnails.mode).toBe('none');
    });

    it('root node', () => {
      const config = createConfig({
        overrides: [
          {
            set: {
              live: {
                controls: {
                  thumbnails: {
                    mode: 'none',
                  },
                },
              },
            },
            conditions: [
              {
                condition: 'fullscreen' as const,
                fullscreen: true,
              },
            ],
          },
        ],
      });

      const stateManager = new ConditionStateManager();
      stateManager.setState({ fullscreen: true });

      const manager = new OverridesManager(vi.fn());
      manager.set(stateManager, config.overrides);

      const overriddenConfig = manager.getConfig(config);

      expect(config.live.controls.thumbnails.mode).toBe('right');
      expect(overriddenConfig.live.controls.thumbnails.mode).toBe('none');
    });
  });

  describe('should handle override delete', () => {
    it('leaf node', () => {
      const config = createConfig({
        live: {
          controls: {
            thumbnails: {
              mode: 'left',
            },
          },
        },
        overrides: [
          {
            delete: ['live.controls.thumbnails.mode' as const],
            conditions: [
              {
                condition: 'fullscreen' as const,
                fullscreen: true,
              },
            ],
          },
        ],
      });

      const stateManager = new ConditionStateManager();
      stateManager.setState({ fullscreen: true });

      const manager = new OverridesManager(vi.fn());
      manager.set(stateManager, config.overrides);

      const overriddenConfig = manager.getConfig(config);

      expect(config.live.controls.thumbnails.mode).toBe('left');
      expect(overriddenConfig.live.controls.thumbnails.mode).toBe('right');
    });

    it('root node', () => {
      const config = createConfig({
        live: {
          controls: {
            thumbnails: {
              mode: 'left',
            },
          },
        },
        overrides: [
          {
            delete: ['live' as const],
            conditions: [
              {
                condition: 'fullscreen' as const,
                fullscreen: true,
              },
            ],
          },
        ],
      });

      const stateManager = new ConditionStateManager();
      stateManager.setState({ fullscreen: true });

      const manager = new OverridesManager(vi.fn());
      manager.set(stateManager, config.overrides);

      const overriddenConfig = manager.getConfig(config);

      expect(config.live.controls.thumbnails.mode).toBe('left');
      expect(overriddenConfig.live.controls.thumbnails.mode).toBe('right');
    });
  });

  it('should throw on invalid schema', () => {
    const config = createConfig({
      overrides: [
        {
          conditions: [
            {
              condition: 'fullscreen' as const,
              fullscreen: true,
            },
          ],
        },
      ],
    });
    config.overrides![0].merge = 6 as unknown as Record<string, unknown>;

    const stateManager = new ConditionStateManager();
    stateManager.setState({ fullscreen: true });

    const manager = new OverridesManager(vi.fn());
    manager.set(stateManager, config.overrides);

    expect(() => manager.getConfig(config)).toThrowError(
      /Invalid override configuration/,
    );
  });

  // See: https://github.com/dermotduffy/advanced-camera-card/issues/1954
  it('should handle overrides separately', () => {
    const config = createConfig({
      live: {
        controls: {
          thumbnails: {
            mode: 'right',
          },
        },
      },
      overrides: [
        {
          set: { 'live.controls.thumbnails.mode': 'left' },
          conditions: [
            {
              condition: 'fullscreen' as const,
              fullscreen: true,
            },
          ],
        },
        {
          set: { 'live.controls.thumbnails.mode': 'none' },
          conditions: [
            {
              condition: 'expand' as const,
              expand: true,
            },
          ],
        },
      ],
    });

    const stateManager = new ConditionStateManager();
    const manager = new OverridesManager(vi.fn());
    manager.set(stateManager, config.overrides);

    expect(manager.getConfig(config).live.controls.thumbnails.mode).toBe('right');

    stateManager.setState({ fullscreen: true });
    expect(manager.getConfig(config).live.controls.thumbnails.mode).toBe('left');

    stateManager.setState({ expand: true });
    expect(manager.getConfig(config).live.controls.thumbnails.mode).toBe('none');

    stateManager.setState({ fullscreen: false });
    expect(manager.getConfig(config).live.controls.thumbnails.mode).toBe('none');

    stateManager.setState({ expand: false });
    expect(manager.getConfig(config).live.controls.thumbnails.mode).toBe('right');
  });
});
