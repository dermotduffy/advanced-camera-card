import { STATE_RUNNING, STATE_STARTING } from 'home-assistant-js-websocket';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventWatcher } from '../../../src/card-controller/hass/event-watcher';
import { HASSManager } from '../../../src/card-controller/hass/hass-manager';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import {
  createCameraConfig,
  createCameraManager,
  createCardAPI,
  createConfig,
  createHASS,
  createStateEntity,
  createStore,
  createView,
} from '../../test-utils';

describe('HASSManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should have null hass on construction', () => {
    const manager = new HASSManager(createCardAPI());
    expect(manager.getHASS()).toBeNull();
    expect(manager.hasHASS()).toBeFalsy();
  });

  it('should get state watcher', () => {
    const manager = new HASSManager(createCardAPI());
    expect(manager.getStateWatcher()).toEqual(expect.any(StateWatcher));
  });

  it('should get event watcher', () => {
    const manager = new HASSManager(createCardAPI());
    expect(manager.getEventWatcher()).toEqual(expect.any(EventWatcher));
  });

  it('should get hass after set', () => {
    const manager = new HASSManager(createCardAPI());
    const hass = createHASS();
    manager.setHASS(hass);

    expect(manager.getHASS()).toBe(hass);
    expect(manager.hasHASS()).toBeTruthy();
  });

  describe('as a HASS source', () => {
    it('should fan out to registered listeners with (hass, oldHass)', () => {
      const manager = new HASSManager(createCardAPI());
      const listener = vi.fn();
      manager.addListener(listener);

      const hass1 = createHASS();
      manager.setHASS(hass1);
      expect(listener).toBeCalledWith(hass1, null);

      const hass2 = createHASS();
      manager.setHASS(hass2);
      expect(listener).toBeCalledWith(hass2, hass1);
    });

    it('should call listeners in insertion order on every fan-out', () => {
      const manager = new HASSManager(createCardAPI());
      const order: string[] = [];
      manager.addListener(() => order.push('first'));
      manager.addListener(() => order.push('second'));

      manager.setHASS(createHASS());

      expect(order).toEqual(['first', 'second']);
    });

    it('should detach a listener via the returned unlisten callback', () => {
      const manager = new HASSManager(createCardAPI());
      const listener = vi.fn();
      const unlisten = manager.addListener(listener);

      unlisten();
      manager.setHASS(createHASS());

      expect(listener).not.toBeCalled();
    });

    it('should not fan out on null/undefined hass', () => {
      const manager = new HASSManager(createCardAPI());
      const listener = vi.fn();
      manager.addListener(listener);

      manager.setHASS(null);
      manager.setHASS();

      expect(listener).not.toBeCalled();
    });

    it('should expose current hass via getHASS for source consumers', () => {
      const manager = new HASSManager(createCardAPI());
      expect(manager.getHASS()).toBeNull();

      const hass = createHASS();
      manager.setHASS(hass);
      expect(manager.getHASS()).toBe(hass);
    });
  });

  describe('should handle connection state change when', () => {
    it('should reinitialize cameras and view on lost → ready transition', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);

      // First establish a fully-ready state.
      const readyHASS = createHASS();
      readyHASS.connected = true;
      readyHASS.config.state = STATE_RUNNING;
      manager.setHASS(readyHASS);

      // Simulate disconnection.
      const disconnectedHASS = createHASS();
      disconnectedHASS.connected = false;
      manager.setHASS(disconnectedHASS);

      // Simulate full recovery (connected AND running).
      const recoveredHASS = createHASS();
      recoveredHASS.connected = true;
      recoveredHASS.config.state = STATE_RUNNING;
      manager.setHASS(recoveredHASS);

      // Cameras and view should be uninitialized so they get re-subscribed
      // to event sources (e.g. Frigate WebSocket events) on the next
      // render cycle.
      expect(api.getInitializationManager().uninitialize).toBeCalledWith('cameras');
      expect(api.getCameraManager().destroy).toBeCalled();
      expect(api.getInitializationManager().uninitialize).toBeCalledWith('view');
      expect(api.getInitializationManager().uninitialize).toBeCalledWith(
        'initial-trigger',
      );
    });

    it('should reinitialize on starting → ready transition (integrations finished loading)', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);

      // WebSocket reconnected but HA still booting.
      const startingHASS = createHASS();
      startingHASS.connected = true;
      startingHASS.config.state = STATE_STARTING;
      manager.setHASS(startingHASS);

      // No reinit yet -- HA isn't fully ready.
      expect(api.getInitializationManager().uninitialize).not.toBeCalled();
      expect(api.getCameraManager().destroy).not.toBeCalled();

      // HA finishes booting.
      const readyHASS = createHASS();
      readyHASS.connected = true;
      readyHASS.config.state = STATE_RUNNING;
      manager.setHASS(readyHASS);

      expect(api.getInitializationManager().uninitialize).toBeCalledWith('cameras');
      expect(api.getCameraManager().destroy).toBeCalled();
      expect(api.getInitializationManager().uninitialize).toBeCalledWith('view');
      expect(api.getInitializationManager().uninitialize).toBeCalledWith(
        'initial-trigger',
      );
    });

    it('should not reinitialize on lost → starting transition', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);

      const disconnectedHASS = createHASS();
      disconnectedHASS.connected = false;
      manager.setHASS(disconnectedHASS);

      const startingHASS = createHASS();
      startingHASS.connected = true;
      startingHASS.config.state = STATE_STARTING;
      manager.setHASS(startingHASS);

      // WS came back but integrations still loading -- wait for RUNNING.
      expect(api.getInitializationManager().uninitialize).not.toBeCalled();
      expect(api.getCameraManager().destroy).not.toBeCalled();
    });

    it('should not reinitialize on first hass set (no previous hass)', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);

      const readyHASS = createHASS();
      readyHASS.connected = true;
      readyHASS.config.state = STATE_RUNNING;
      manager.setHASS(readyHASS);

      // First-ever hass set -- there's no "previous not-ready state" to
      // transition from, so the normal first-load init flow applies and we must
      // not blow away cameras.
      expect(api.getInitializationManager().uninitialize).not.toBeCalled();
      expect(api.getCameraManager().destroy).not.toBeCalled();
    });

    it('should not reinitialize on ready → ready (no transition)', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);

      const readyHASS = createHASS();
      readyHASS.connected = true;
      readyHASS.config.state = STATE_RUNNING;
      manager.setHASS(readyHASS);

      const anotherReadyHASS = createHASS();
      anotherReadyHASS.connected = true;
      anotherReadyHASS.config.state = STATE_RUNNING;
      manager.setHASS(anotherReadyHASS);

      expect(api.getInitializationManager().uninitialize).not.toBeCalled();
      expect(api.getCameraManager().destroy).not.toBeCalled();
    });

    it('should not crash when hass is null', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);
      const connectedHASS = createHASS();
      connectedHASS.connected = true;

      manager.setHASS(connectedHASS);
      manager.setHASS(null);
      manager.setHASS(connectedHASS);
    });
  });

  describe('should not set default view when', () => {
    it('should not set default view when selected camera is unknown', () => {
      const api = createCardAPI();
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.foo',
            config: createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion'],
              },
            }),
          },
        ]),
      );
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          camera: 'camera.UNKNOWN',
        }),
      );

      const manager = new HASSManager(api);
      const hass = createHASS({
        'binary_sensor.motion': createStateEntity(),
      });

      manager.setHASS(hass);

      expect(api.getViewManager().setViewDefault).not.toBeCalled();
    });

    it('should not set default view when there is card interaction', () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              entities: ['sensor.force_default_view'],
            },
          },
        }),
      );
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(true);

      const manager = new HASSManager(api);
      const hass = createHASS({
        'sensor.force_default_view': createStateEntity(),
      });

      manager.setHASS(hass);

      expect(api.getViewManager().setViewDefault).not.toBeCalled();
    });
  });
});
