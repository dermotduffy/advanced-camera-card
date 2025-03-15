import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CardElementManager } from '../../src/card-controller/card-element-manager';
import { StateWatcher } from '../../src/card-controller/hass/state-watcher';
import {
  callStateWatcherCallback,
  createCardAPI,
  createConfig,
  createLitElement,
  createStateEntity,
} from '../test-utils';

// @vitest-environment jsdom
describe('CardElementManager', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should get element', () => {
    const element = createLitElement();
    const manager = new CardElementManager(
      createCardAPI(),
      element,
      () => undefined,
      () => undefined,
    );

    expect(manager.getElement()).toBe(element);
  });

  it('should reset scroll', () => {
    const callback = vi.fn();
    const manager = new CardElementManager(
      createCardAPI(),
      createLitElement(),
      callback,
      () => undefined,
    );

    manager.scrollReset();

    expect(callback).toBeCalled();
  });

  it('should toggle menu', () => {
    const callback = vi.fn();
    const manager = new CardElementManager(
      createCardAPI(),
      createLitElement(),
      () => undefined,
      callback,
    );

    manager.toggleMenu();

    expect(callback).toBeCalled();
  });

  it('should update', () => {
    const element = createLitElement();
    const manager = new CardElementManager(
      createCardAPI(),
      element,
      () => undefined,
      () => undefined,
    );

    manager.update();
    expect(element.requestUpdate).toBeCalled();
  });

  it('should get hasUpdated', () => {
    const element = createLitElement();
    element.hasUpdated = true;
    const manager = new CardElementManager(
      createCardAPI(),
      element,
      () => undefined,
      () => undefined,
    );

    expect(manager.hasUpdated()).toBeTruthy();
  });

  it('should connect', () => {
    const windowAddEventListener = vi.spyOn(global.window, 'addEventListener');

    const addEventListener = vi.fn();
    const element = createLitElement();
    element.addEventListener = addEventListener;

    const api = createCardAPI();
    const manager = new CardElementManager(
      api,
      element,
      () => undefined,
      () => undefined,
    );

    manager.elementConnected();

    expect(element.getAttribute('panel')).toBeNull();
    expect(element.getAttribute('casted')).toBeNull();
    expect(api.getFullscreenManager().connect).toBeCalled();

    expect(addEventListener).toBeCalledWith(
      'mousemove',
      api.getInteractionManager().reportInteraction,
    );
    expect(addEventListener).toBeCalledWith(
      'll-custom',
      api.getActionsManager().handleCustomActionEvent,
    );
    expect(addEventListener).toBeCalledWith(
      'action',
      api.getActionsManager().handleInteractionEvent,
    );
    expect(addEventListener).toBeCalledWith(
      'action',
      api.getInteractionManager().reportInteraction,
    );
    expect(windowAddEventListener).toBeCalledWith('location-changed', expect.anything());
    expect(windowAddEventListener).toBeCalledWith('popstate', expect.anything());

    expect(api.getInteractionManager().initialize).toBeCalled();
    expect(api.getFullscreenManager().initialize).toBeCalled();
    expect(api.getExpandManager().initialize).toBeCalled();
    expect(api.getMediaLoadedInfoManager().initialize).toBeCalled();
    expect(api.getMicrophoneManager().initialize).toBeCalled();
  });

  it('should disconnect', () => {
    const windowRemoveEventListener = vi.spyOn(global.window, 'removeEventListener');

    const element = createLitElement();
    element.setAttribute('panel', '');
    element.setAttribute('casted', '');

    const removeEventListener = vi.fn();
    element.removeEventListener = removeEventListener;

    const api = createCardAPI();

    const manager = new CardElementManager(
      api,
      element,
      () => undefined,
      () => undefined,
    );

    manager.elementDisconnected();

    expect(element.getAttribute('panel')).toBeNull();
    expect(element.getAttribute('casted')).toBeNull();
    expect(api.getMediaLoadedInfoManager().clear).toBeCalled();
    expect(api.getFullscreenManager().disconnect).toBeCalled();

    expect(removeEventListener).toBeCalledWith(
      'mousemove',
      api.getInteractionManager().reportInteraction,
    );
    expect(removeEventListener).toBeCalledWith(
      'll-custom',
      api.getActionsManager().handleCustomActionEvent,
    );
    expect(removeEventListener).toBeCalledWith(
      'action',
      api.getActionsManager().handleInteractionEvent,
    );
    expect(removeEventListener).toBeCalledWith(
      'action',
      api.getInteractionManager().reportInteraction,
    );
    expect(windowRemoveEventListener).toBeCalledWith(
      'location-changed',
      expect.anything(),
    );
    expect(windowRemoveEventListener).toBeCalledWith('popstate', expect.anything());

    expect(api.getMediaLoadedInfoManager().clear).toBeCalled();
    expect(api.getFullscreenManager().disconnect).toBeCalled();
    expect(api.getKeyboardStateManager().uninitialize).toBeCalled();
    expect(api.getActionsManager().uninitialize).toBeCalled();
    expect(api.getInitializationManager().uninitialize).toBeCalledWith('cameras');
  });

  describe('should update card when', () => {
    it('render entity changes', () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            render_entities: ['sensor.force_update'],
          },
        }),
      );

      const stateWatcher = mock<StateWatcher>();
      vi.mocked(api.getHASSManager().getStateWatcher).mockReturnValue(stateWatcher);

      const element = createLitElement();
      const manager = new CardElementManager(
        api,
        element,
        () => undefined,
        () => undefined,
      );

      manager.elementConnected();

      const diff = {
        entityID: 'sensor.force_update',
        newState: createStateEntity({ state: 'off' }),
      };
      callStateWatcherCallback(stateWatcher, diff);

      expect(element.requestUpdate).toBeCalled();
    });

    it('media player entity changes', () => {
      const api = createCardAPI();
      vi.mocked(api.getMediaPlayerManager().getMediaPlayers).mockReturnValue([
        'media_player.foo',
      ]);

      const stateWatcher = mock<StateWatcher>();
      vi.mocked(api.getHASSManager().getStateWatcher).mockReturnValue(stateWatcher);

      const element = createLitElement();
      const manager = new CardElementManager(
        api,
        element,
        () => undefined,
        () => undefined,
      );

      manager.elementConnected();

      const diff = {
        entityID: 'sensor.force_update',
        newState: createStateEntity({ state: 'off' }),
      };
      callStateWatcherCallback(stateWatcher, diff);

      expect(element.requestUpdate).toBeCalled();
    });
  });
});
