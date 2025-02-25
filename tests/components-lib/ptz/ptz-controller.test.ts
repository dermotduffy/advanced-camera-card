import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capabilities } from '../../../src/camera-manager/capabilities';
import { PTZController } from '../../../src/components-lib/ptz/ptz-controller';
import { PTZControlAction } from '../../../src/config/ptz';
import { PTZControlsConfig, ptzControlsConfigSchema } from '../../../src/config/types';
import { createCameraManager, createCapabilities, createStore } from '../../test-utils';

const createConfig = (config?: Partial<PTZControlsConfig>): PTZControlsConfig => {
  return ptzControlsConfigSchema.parse({
    ...config,
  });
};

// @vitest-environment jsdom
describe('PTZController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should be creatable', () => {
    const controller = new PTZController(document.createElement('div'));
    expect(controller).toBeTruthy();
  });

  it('should get config', () => {
    const controller = new PTZController(document.createElement('div'));
    const config = createConfig();
    controller.setConfig(config);
    expect(controller.getConfig()).toBe(config);
  });

  describe('should set element attributes', () => {
    describe('orientation', () => {
      describe('with config', () => {
        it.each([['horizontal' as const], ['vertical' as const]])(
          '%s',
          (orientation: 'horizontal' | 'vertical') => {
            const element = document.createElement('div');
            const controller = new PTZController(element);
            controller.setConfig(createConfig({ orientation: orientation }));
            expect(element.getAttribute('data-orientation')).toBe(orientation);
          },
        );
      });
      it('without config', () => {
        const element = document.createElement('div');
        const controller = new PTZController(element);
        controller.setConfig();
        expect(element.getAttribute('data-orientation')).toBe('horizontal');
      });
    });
    describe('position', () => {
      describe('with config', () => {
        it.each([
          ['top-left' as const],
          ['top-right' as const],
          ['bottom-left' as const],
          ['bottom-right' as const],
        ])(
          '%s',
          (position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
            const element = document.createElement('div');
            const controller = new PTZController(element);
            controller.setConfig(createConfig({ position: position }));
            expect(element.getAttribute('data-position')).toBe(position);
          },
        );
      });
      it('without config', () => {
        const element = document.createElement('div');
        const controller = new PTZController(element);
        controller.setConfig();
        expect(element.getAttribute('data-position')).toBe('bottom-right');
      });
    });
    it('with style in config', () => {
      const element = document.createElement('div');
      const controller = new PTZController(element);
      controller.setConfig(createConfig({ style: { transform: 'none', left: '50%' } }));
      expect(element.getAttribute('style')).toBe('transform:none;left:50%');
    });
  });

  describe('should respect mode', () => {
    it('off', () => {
      const controller = new PTZController(document.createElement('div'));
      expect(controller.shouldDisplay()).toBeFalsy();
    });
    it('forced on', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setForceVisibility(true);

      expect(controller.shouldDisplay()).toBeTruthy();
    });
    it('forced off', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setForceVisibility(false);
      expect(controller.shouldDisplay()).toBeFalsy();
    });

    it('configured on', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setConfig(createConfig({ mode: 'on' }));
      expect(controller.shouldDisplay()).toBeTruthy();
    });
    it('configured off', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setConfig(createConfig({ mode: 'off' }));
      expect(controller.shouldDisplay()).toBeFalsy();
    });

    it('auto without capability', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setConfig(createConfig({ mode: 'auto' }));
      controller.setCamera(createCameraManager(), 'camera.office');
      expect(controller.shouldDisplay()).toBeFalsy();
    });
    it('auto with capability', () => {
      const store = createStore([
        {
          cameraID: 'camera.office',
          capabilities: new Capabilities({ ptz: { left: ['relative'] } }),
        },
      ]);
      const cameraManager = createCameraManager(store);
      vi.mocked(cameraManager).getCameraCapabilities.mockReturnValue(
        createCapabilities({
          ptz: {
            left: ['relative'],
          },
        }),
      );

      const controller = new PTZController(document.createElement('div'));
      controller.setConfig(createConfig({ mode: 'auto' }));
      controller.setCamera(cameraManager, 'camera.office');
      expect(controller.shouldDisplay()).toBeTruthy();
    });
  });

  describe('should get PTZ actions', () => {
    it.each([
      ['left' as const],
      ['right' as const],
      ['up' as const],
      ['down' as const],
      ['zoom_in' as const],
      ['zoom_out' as const],
    ])('%s', (actionName: PTZControlAction) => {
      const controller = new PTZController(document.createElement('div'));
      controller.setConfig(createConfig());

      const store = createStore([
        {
          cameraID: 'camera.office',
          capabilities: new Capabilities({
            ptz: {
              left: ['relative'],
              right: ['relative'],
              up: ['relative'],
              down: ['relative'],
              zoomIn: ['relative'],
              zoomOut: ['relative'],
            },
          }),
        },
      ]);

      const cameraManager = createCameraManager(store);
      controller.setCamera(cameraManager, 'camera.office');

      expect(controller.getPTZActions()?.[actionName]).toEqual({
        start_tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_multi',
          ptz_action: actionName,
          ptz_phase: 'start',
        },
        end_tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_multi',
          ptz_action: actionName,
          ptz_phase: 'stop',
        },
      });
    });

    it('home', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setConfig(createConfig());

      const store = createStore([
        {
          cameraID: 'camera.office',
          capabilities: new Capabilities({
            ptz: {
              left: ['relative'],
              right: ['relative'],
              up: ['relative'],
              down: ['relative'],
              zoomIn: ['relative'],
              zoomOut: ['relative'],
              presets: ['door', 'window'],
            },
          }),
        },
      ]);

      const cameraManager = createCameraManager(store);
      controller.setCamera(cameraManager, 'camera.office');

      expect(controller.getPTZActions()['home']).toEqual({
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_multi',
        },
      });
    });

    it('only presets', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setConfig(createConfig());

      const store = createStore([
        {
          cameraID: 'camera.office',
          capabilities: new Capabilities({
            ptz: {
              presets: ['door', 'window'],
            },
          }),
        },
      ]);

      const cameraManager = createCameraManager(store);
      controller.setCamera(cameraManager, 'camera.office');

      expect(controller.getPTZActions()['presets']).toEqual([
        {
          actions: {
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'ptz_multi',
              ptz_action: 'preset',
              ptz_preset: 'door',
            },
          },
          preset: 'door',
        },
        {
          actions: {
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'ptz_multi',
              ptz_action: 'preset',
              ptz_preset: 'window',
            },
          },
          preset: 'window',
        },
      ]);
    });

    it('should return digital PTZ actions without camera capabilities', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setConfig(createConfig());

      expect(controller.getPTZActions()).toEqual({
        down: {
          end_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'down',
            ptz_phase: 'stop',
          },
          start_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'down',
            ptz_phase: 'start',
          },
        },
        home: {
          tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
          },
        },
        left: {
          end_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'left',
            ptz_phase: 'stop',
          },
          start_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'left',
            ptz_phase: 'start',
          },
        },
        right: {
          end_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'right',
            ptz_phase: 'stop',
          },
          start_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'right',
            ptz_phase: 'start',
          },
        },
        up: {
          end_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'up',
            ptz_phase: 'stop',
          },
          start_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'up',
            ptz_phase: 'start',
          },
        },
        zoom_in: {
          end_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'zoom_in',
            ptz_phase: 'stop',
          },
          start_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'zoom_in',
            ptz_phase: 'start',
          },
        },
        zoom_out: {
          end_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'zoom_out',
            ptz_phase: 'stop',
          },
          start_tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_multi',
            ptz_action: 'zoom_out',
            ptz_phase: 'start',
          },
        },
      });
    });
  });

  describe('should handle action', () => {
    it('successfully', () => {
      const action = {
        action: 'more-info' as const,
      };
      const config = {
        tap_action: action,
        camera_entity: 'camera.office',
      };

      const element = document.createElement('div');
      const handler = vi.fn();
      element.addEventListener('advanced-camera-card:action:execution-request', handler);

      const controller = new PTZController(element);
      controller.setCamera();
      controller.handleAction(
        new CustomEvent<{ action: string }>('@action', { detail: { action: 'tap' } }),
        config,
      );

      expect(handler).toBeCalledWith(
        expect.objectContaining({
          detail: {
            action: action,
            config: config,
          },
        }),
      );
    });

    it('should not call action without actions config', () => {
      const element = document.createElement('div');
      const handler = vi.fn();
      element.addEventListener('advanced-camera-card:action:execution-request', handler);

      const controller = new PTZController(element);
      controller.setCamera();
      controller.handleAction(
        new CustomEvent<{ action: string }>('@action', { detail: { action: 'tap' } }),
      );

      expect(handler).not.toBeCalled();
    });

    it('should not call action without hass', () => {
      const element = document.createElement('div');
      const handler = vi.fn();
      element.addEventListener('advanced-camera-card:action:execution-request', handler);

      const controller = new PTZController(element);
      controller.setCamera();
      controller.handleAction(
        new CustomEvent<{ action: string }>('@action', { detail: { action: 'tap' } }),
      );

      expect(handler).not.toBeCalled();
    });
  });
});
