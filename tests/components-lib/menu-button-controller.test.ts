import isEqual from 'lodash-es/isEqual';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Capabilities } from '../../src/camera-manager/capabilities.js';
import { CameraManager } from '../../src/camera-manager/manager.js';
import { CameraManagerCameraMetadata } from '../../src/camera-manager/types.js';
import { FullscreenManager } from '../../src/card-controller/fullscreen/fullscreen-manager.js';
import { MediaPlayerManager } from '../../src/card-controller/media-player-manager.js';
import { MicrophoneManager } from '../../src/card-controller/microphone-manager.js';
import { ViewManager } from '../../src/card-controller/view/view-manager.js';
import {
  MenuButtonController,
  MenuButtonControllerOptions,
} from '../../src/components-lib/menu-button-controller.js';
import {
  AdvancedCameraCardConfig,
  AdvancedCameraCardView,
  MenuItem,
  ViewDisplayMode,
} from '../../src/config/types.js';
import { HomeAssistant } from '../../src/ha/types.js';
import { MediaPlayerController } from '../../src/types.js';
import { createGeneralAction, createViewAction } from '../../src/utils/action.js';
import { MediaQueriesResults } from '../../src/view/media-queries-results.js';
import { ViewMedia } from '../../src/view/media.js';
import { View } from '../../src/view/view.js';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createConfig,
  createHASS,
  createMediaCapabilities,
  createMediaLoadedInfo,
  createStateEntity,
  createStore,
  createView,
  TestViewMedia,
} from '../test-utils.js';

vi.mock('../../src/utils/media-player-controller.js');
vi.mock('../../src/card-controller/microphone-manager.js');

const calculateButtons = (
  controller: MenuButtonController,
  options?: MenuButtonControllerOptions & {
    hass?: HomeAssistant;
    config?: AdvancedCameraCardConfig;
    cameraManager?: CameraManager;
    view?: View | null;
    viewManager?: ViewManager;
  },
): MenuItem[] => {
  let cameraManager: CameraManager | null = options?.cameraManager ?? null;
  if (!cameraManager) {
    cameraManager = createCameraManager();
  }

  return controller.calculateButtons(
    options?.hass ?? createHASS(),
    options?.config ?? createConfig(),
    cameraManager,
    {
      ...options,
      view:
        options?.view === undefined ? createView({ camera: 'camera-1' }) : options.view,
    },
  );
};

// @vitest-environment jsdom
describe('MenuButtonController', () => {
  let controller: MenuButtonController;
  const dynamicButton: MenuItem = {
    type: 'custom:advanced-camera-card-menu-icon',
    icon: 'mdi:alpha-a-circle',
    title: 'Dynamic button',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    controller = new MenuButtonController();
  });

  describe('should have iris menu button', () => {
    it('with hidden menu style', () => {
      const buttons = calculateButtons(controller);

      expect(buttons).toContainEqual({
        icon: 'iris',
        enabled: true,
        permanent: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Iris / Default View / Unhide menu',
        tap_action: createGeneralAction('menu_toggle'),
        hold_action: createViewAction('diagnostics'),
      });
    });

    it('without hidden menu style', () => {
      const buttons = calculateButtons(controller, {
        config: createConfig({ menu: { style: 'overlay' } }),
      });

      expect(buttons).toContainEqual({
        icon: 'iris',
        enabled: true,
        permanent: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Iris / Default View / Unhide menu',
        tap_action: createGeneralAction('default'),
        hold_action: createViewAction('diagnostics'),
      });
    });
  });

  describe('should have cameras menu', () => {
    it('should have cameras menu with multiple cameras', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          { cameraID: 'camera-1', capabilities: createCapabilities({ menu: true }) },
          { cameraID: 'camera-2', capabilities: createCapabilities({ menu: true }) },
          { cameraID: 'camera-3', capabilities: createCapabilities({ menu: false }) },
        ]),
      );
      vi.mocked(cameraManager).getCameraMetadata.mockReturnValue({
        title: 'title',
        icon: {
          icon: 'icon',
        },
      });
      const buttons = calculateButtons(controller, { cameraManager: cameraManager });

      expect(buttons).toContainEqual({
        icon: 'mdi:video-switch',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-submenu',
        title: 'Cameras',
        items: [
          {
            enabled: true,
            icon: 'icon',
            entity: undefined,
            state_color: true,
            title: 'title',
            selected: true,
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'camera_select',
              camera: 'camera-1',
            },
          },
          {
            enabled: true,
            icon: 'icon',
            entity: undefined,
            state_color: true,
            title: 'title',
            selected: false,
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'camera_select',
              camera: 'camera-2',
            },
          },
        ],
      });
    });

    it('should not have cameras menu with <= 1 camera', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          { cameraID: 'camera-1', capabilities: createCapabilities({ menu: true }) },
          { cameraID: 'camera-3', capabilities: createCapabilities({ menu: false }) },
        ]),
      );
      vi.mocked(cameraManager).getCameraMetadata.mockReturnValue({
        title: 'title',
        icon: {
          icon: 'icon',
        },
      });
      const buttons = calculateButtons(controller, { cameraManager: cameraManager });

      expect(buttons).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Cameras',
          }),
        ]),
      );
    });
  });

  describe('should have substream button', () => {
    it('with no view', () => {
      const buttons = calculateButtons(controller, {
        cameraManager: createCameraManager(),
        view: null,
      });

      expect(buttons).not.toContainEqual(
        expect.objectContaining({
          title: 'Substream(s)',
        }),
      );
    });

    it('with no dependency', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera-1',
            capabilities: createCapabilities({ substream: true }),
          },
        ]),
      );
      const buttons = calculateButtons(controller, { cameraManager: cameraManager });

      expect(buttons).not.toContainEqual(
        expect.objectContaining({
          title: 'Substream(s)',
        }),
      );
    });

    it('with single dependency', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera-1',
            config: createCameraConfig({ dependencies: { cameras: ['camera-2'] } }),
          },
          {
            cameraID: 'camera-2',
            capabilities: createCapabilities({ substream: true }),
          },
        ]),
      );
      const buttons = calculateButtons(controller, { cameraManager: cameraManager });

      expect(buttons).toContainEqual({
        icon: 'mdi:video-input-component',
        style: {},
        title: 'Substream(s)',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'live_substream_on',
        },
      });
    });

    it('with substream selected and single dependency', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera-1',
            config: createCameraConfig({ dependencies: { cameras: ['camera-2'] } }),
          },
          {
            cameraID: 'camera-2',
            capabilities: createCapabilities({ substream: true }),
          },
        ]),
      );
      const view = createView({
        camera: 'camera-1',
        context: {
          live: {
            overrides: new Map([['camera-1', 'camera-2']]),
          },
        },
      });
      const buttons = calculateButtons(controller, {
        cameraManager: cameraManager,
        view: view,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:video-input-component',
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
        title: 'Substream(s)',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'live_substream_off',
        },
      });
    });

    it('with substream unselected and multiple dependencies', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera-1',
            config: createCameraConfig({
              camera_entity: 'camera.1',
              dependencies: { cameras: ['camera-2', 'camera-3'] },
            }),
            capabilities: createCapabilities({ substream: true }),
          },
          {
            cameraID: 'camera-2',
            config: createCameraConfig({
              camera_entity: 'camera.2',
            }),
            capabilities: createCapabilities({ substream: true }),
          },
          {
            cameraID: 'camera-3',
            config: createCameraConfig({
              camera_entity: 'camera.3',
            }),
            capabilities: createCapabilities({ substream: true }),
          },
        ]),
      );

      // Return different metadata depending on the camera to test multiple code
      // paths.
      mock<CameraManager>(cameraManager).getCameraMetadata.mockImplementation(
        (cameraID: string): CameraManagerCameraMetadata | null => {
          return cameraID === 'camera-1'
            ? {
                title: 'title',
                icon: {
                  icon: 'icon',
                  entity: 'entity',
                },
              }
            : null;
        },
      );

      const buttons = calculateButtons(controller, { cameraManager: cameraManager });

      expect(buttons).toContainEqual({
        icon: 'mdi:video-input-component',
        title: 'Substream(s)',
        style: {},
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-submenu',
        items: [
          {
            enabled: true,
            icon: 'icon',
            entity: 'entity',
            state_color: true,
            title: 'title',
            selected: true,
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'live_substream_select',
              camera: 'camera-1',
            },
          },
          {
            enabled: true,
            icon: undefined,
            entity: undefined,
            state_color: true,
            title: undefined,
            selected: false,
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'live_substream_select',
              camera: 'camera-2',
            },
          },
          {
            enabled: true,
            icon: undefined,
            entity: undefined,
            state_color: true,
            title: undefined,
            selected: false,
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'live_substream_select',
              camera: 'camera-3',
            },
          },
        ],
      });
    });

    it('with substream selected and with multiple dependencies', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera-1',
            config: createCameraConfig({
              camera_entity: 'camera.1',
              dependencies: { cameras: ['camera-2', 'camera-3'] },
            }),
            capabilities: createCapabilities({ substream: true }),
          },
          {
            cameraID: 'camera-2',
            config: createCameraConfig({
              camera_entity: 'camera.2',
            }),
            capabilities: createCapabilities({ substream: true }),
          },
          {
            cameraID: 'camera-3',
            config: createCameraConfig({
              camera_entity: 'camera.3',
            }),
            capabilities: createCapabilities({ substream: true }),
          },
        ]),
      );
      const view = createView({
        camera: 'camera-1',
        context: {
          live: {
            overrides: new Map([['camera-1', 'camera-2']]),
          },
        },
      });
      const buttons = calculateButtons(controller, {
        cameraManager: cameraManager,
        view: view,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:video-input-component',
        title: 'Substream(s)',
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-submenu',
        items: [
          {
            enabled: true,
            icon: undefined,
            entity: undefined,
            state_color: true,
            title: undefined,
            selected: false,
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'live_substream_select',
              camera: 'camera-1',
            },
          },
          {
            enabled: true,
            icon: undefined,
            entity: undefined,
            state_color: true,
            title: undefined,
            // camera-2 is selected in this test scenario because of the view
            // override.
            selected: true,
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'live_substream_select',
              camera: 'camera-2',
            },
          },
          {
            enabled: true,
            icon: undefined,
            entity: undefined,
            state_color: true,
            title: undefined,
            selected: false,
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'live_substream_select',
              camera: 'camera-3',
            },
          },
        ],
      });
    });
  });

  describe('should have live menu button', () => {
    it('when in live view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);
      const buttons = calculateButtons(controller, {
        view: createView({ view: 'live' }),
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:cctv',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Live view',
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
        tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
      });
    });

    it('when not in live view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);
      const buttons = calculateButtons(controller, {
        view: createView({ view: 'clips' }),
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:cctv',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Live view',
        style: {},
        tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'live' },
      });
    });

    it('when not supported', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(false);
      const buttons = calculateButtons(controller, {
        viewManager: viewManager,
      });

      expect(buttons).not.toContainEqual(
        expect.objectContaining({
          title: 'Live view',
        }),
      );
    });
  });

  describe('should have clips menu button', () => {
    it('when in clips view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);
      const buttons = calculateButtons(controller, {
        view: createView({ view: 'clips' }),
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:filmstrip',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Clips gallery',
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
        tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'clips' },
        hold_action: { action: 'fire-dom-event', advanced_camera_card_action: 'clip' },
      });
    });

    it('when not in clips view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);
      const buttons = calculateButtons(controller, {
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:filmstrip',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Clips gallery',
        style: {},
        tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'clips' },
        hold_action: { action: 'fire-dom-event', advanced_camera_card_action: 'clip' },
      });
    });

    it('when not supported', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(false);
      const buttons = calculateButtons(controller, {
        viewManager: viewManager,
      });

      expect(buttons).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ title: 'Clips gallery' })]),
      );
    });
  });

  describe('should have snapshots menu button', () => {
    it('when in snapshots view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);
      const buttons = calculateButtons(controller, {
        view: createView({ view: 'snapshots' }),
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:camera',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Snapshots gallery',
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'snapshots',
        },
        hold_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'snapshot',
        },
      });
    });

    it('when not in snapshots view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);
      const buttons = calculateButtons(controller, {
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:camera',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Snapshots gallery',
        style: {},
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'snapshots',
        },
        hold_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'snapshot',
        },
      });
    });

    it('when not supported', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(false);
      const buttons = calculateButtons(controller, {
        viewManager: viewManager,
      });

      expect(buttons).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Snapshots gallery' }),
        ]),
      );
    });
  });

  describe('should have recordings menu button', () => {
    it('when in recordings view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);
      const buttons = calculateButtons(controller, {
        view: createView({ view: 'recordings' }),
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:album',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Recordings gallery',
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'recordings',
        },
        hold_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'recording',
        },
      });
    });

    it('when not in recordings view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);
      const buttons = calculateButtons(controller, {
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:album',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Recordings gallery',
        style: {},
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'recordings',
        },
        hold_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'recording',
        },
      });
    });

    it('when not supported', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(false);
      const buttons = calculateButtons(controller, {
        viewManager: viewManager,
      });

      expect(buttons).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Recordings gallery' }),
        ]),
      );
    });
  });

  describe('should have image menu button', () => {
    it('when in image view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);

      const buttons = calculateButtons(controller, {
        view: createView({ view: 'image' }),
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:image',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Static image',
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
        tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'image' },
      });
    });

    it('when not in image view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);

      const buttons = calculateButtons(controller, {
        view: createView({ view: 'live' }),
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:image',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Static image',
        style: {},
        tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'image' },
      });
    });

    it('when not supported', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(false);
      const buttons = calculateButtons(controller, {
        viewManager: viewManager,
      });

      expect(buttons).not.toContainEqual(
        expect.objectContaining({
          title: 'Static image',
        }),
      );
    });
  });

  describe('should have timeline button', () => {
    it('when in timeline view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);
      const buttons = calculateButtons(controller, {
        view: createView({ view: 'timeline' }),
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:chart-gantt',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Timeline view',
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'timeline',
        },
      });
    });

    it('when not in timeline view', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(true);
      const buttons = calculateButtons(controller, {
        view: createView({ view: 'live' }),
        viewManager: viewManager,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:chart-gantt',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Timeline view',
        style: {},
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'timeline',
        },
      });
    });

    it('when not supported', () => {
      const viewManager = mock<ViewManager>();
      vi.mocked(viewManager.isViewSupportedByCamera).mockReturnValue(false);
      const buttons = calculateButtons(controller, {
        view: createView({ view: 'live' }),
        viewManager: viewManager,
      });

      expect(buttons).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ title: 'Timeline view' })]),
      );
    });
  });

  describe('should have download button', () => {
    it('when media available', () => {
      vi.stubGlobal('navigator', { userAgent: 'foo' });

      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getMediaCapabilities).mockReturnValue(
        createMediaCapabilities({ canDownload: true }),
      );
      const view = createView({
        view: 'media',
        queryResults: new MediaQueriesResults({
          results: [new ViewMedia('clip', 'camera-1')],
          selectedIndex: 0,
        }),
      });
      const buttons = calculateButtons(controller, {
        cameraManager: cameraManager,
        view: view,
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:download',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Download',
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'download',
        },
      });
    });

    it('not when being casted', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Fuchsia) AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/114.0.0.0 Safari/537.36 CrKey/1.56.500000',
      });

      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getMediaCapabilities).mockReturnValue(
        createMediaCapabilities({ canDownload: true }),
      );
      const view = createView({
        queryResults: new MediaQueriesResults({
          results: [new ViewMedia('clip', 'camera-1')],
          selectedIndex: 0,
        }),
      });
      const buttons = calculateButtons(controller, {
        cameraManager: cameraManager,
        view: view,
      });

      expect(buttons).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ title: 'Download' })]),
      );
    });

    it('not in a non-media view', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getMediaCapabilities).mockReturnValue(
        createMediaCapabilities({ canDownload: true }),
      );
      const view = createView({
        view: 'live',
        queryResults: new MediaQueriesResults({
          results: [new ViewMedia('clip', 'camera-1')],
          selectedIndex: 0,
        }),
      });
      const buttons = calculateButtons(controller, {
        cameraManager: cameraManager,
        view: view,
      });

      expect(buttons).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ title: 'Download' })]),
      );
    });
  });

  it('should have camera UI button', () => {
    const buttons = calculateButtons(controller, {
      showCameraUIButton: true,
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:web',
      enabled: true,
      priority: 50,
      type: 'custom:advanced-camera-card-menu-icon',
      title: 'Camera user interface',
      tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'camera_ui' },
    });
  });

  describe('should have microphone button', () => {
    it('with suitable loaded media', () => {
      const microphoneManager = mock<MicrophoneManager>();
      vi.mocked(microphoneManager.isForbidden).mockReturnValue(false);
      vi.mocked(microphoneManager.isMuted).mockReturnValue(false);
      vi.mocked(microphoneManager.isSupported).mockReturnValue(true);

      const buttons = calculateButtons(controller, {
        microphoneManager: microphoneManager,
        currentMediaLoadedInfo: createMediaLoadedInfo({
          capabilities: {
            supports2WayAudio: true,
          },
        }),
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:microphone',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Microphone',
        style: {
          animation: 'pulse 3s infinite',
          color: 'var(--advanced-camera-card-menu-button-critical-color)',
        },
        start_tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'microphone_unmute',
        },
        end_tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'microphone_mute',
        },
      });
    });

    it('without suitable loaded media', () => {
      const microphoneManager = mock<MicrophoneManager>();
      vi.mocked(microphoneManager.isForbidden).mockReturnValue(false);
      vi.mocked(microphoneManager.isMuted).mockReturnValue(false);
      vi.mocked(microphoneManager.isSupported).mockReturnValue(true);

      const buttons = calculateButtons(controller, {
        microphoneManager: microphoneManager,
        currentMediaLoadedInfo: createMediaLoadedInfo({
          capabilities: {
            supports2WayAudio: false,
          },
        }),
      });

      expect(buttons).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ title: 'Microphone' })]),
      );
    });

    it('with forbidden microphone', () => {
      const microphoneManager = mock<MicrophoneManager>();
      vi.mocked(microphoneManager.isForbidden).mockReturnValue(true);

      const buttons = calculateButtons(controller, {
        microphoneManager: microphoneManager,
        currentMediaLoadedInfo: createMediaLoadedInfo({
          capabilities: {
            supports2WayAudio: true,
          },
        }),
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:microphone-message-off',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Microphone',
        style: {},
      });
    });

    it('with muted microphone', () => {
      const microphoneManager = mock<MicrophoneManager>();
      vi.mocked(microphoneManager.isForbidden).mockReturnValue(false);
      vi.mocked(microphoneManager.isMuted).mockReturnValue(true);
      vi.mocked(microphoneManager.isSupported).mockReturnValue(true);

      const buttons = calculateButtons(controller, {
        microphoneManager: microphoneManager,
        currentMediaLoadedInfo: createMediaLoadedInfo({
          capabilities: {
            supports2WayAudio: true,
          },
        }),
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:microphone-off',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Microphone',
        style: {},
        start_tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'microphone_unmute',
        },
        end_tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'microphone_mute',
        },
      });
    });

    it('with unsupported microphone', () => {
      const microphoneManager = mock<MicrophoneManager>();
      vi.mocked(microphoneManager.isForbidden).mockReturnValue(false);
      vi.mocked(microphoneManager.isMuted).mockReturnValue(true);
      vi.mocked(microphoneManager.isSupported).mockReturnValue(false);

      const buttons = calculateButtons(controller, {
        microphoneManager: microphoneManager,
        currentMediaLoadedInfo: createMediaLoadedInfo({
          capabilities: {
            supports2WayAudio: true,
          },
        }),
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:microphone-message-off',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Microphone',
        style: {},
      });
    });

    it('with muted toggle type microphone', () => {
      const microphoneManager = mock<MicrophoneManager>();
      vi.mocked(microphoneManager.isForbidden).mockReturnValue(false);
      vi.mocked(microphoneManager.isMuted).mockReturnValue(true);
      vi.mocked(microphoneManager.isSupported).mockReturnValue(true);

      const buttons = calculateButtons(controller, {
        microphoneManager: microphoneManager,
        currentMediaLoadedInfo: createMediaLoadedInfo({
          capabilities: {
            supports2WayAudio: true,
          },
        }),
        config: createConfig({
          menu: { buttons: { microphone: { type: 'toggle' } } },
        }),
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:microphone-off',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Microphone',
        style: {},
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'microphone_unmute',
        },
      });
    });

    it('with unmuted toggle type microphone', () => {
      const microphoneManager = mock<MicrophoneManager>();
      vi.mocked(microphoneManager.isForbidden).mockReturnValue(false);
      vi.mocked(microphoneManager.isMuted).mockReturnValue(false);
      vi.mocked(microphoneManager.isSupported).mockReturnValue(true);

      const buttons = calculateButtons(controller, {
        microphoneManager: microphoneManager,
        currentMediaLoadedInfo: createMediaLoadedInfo({
          capabilities: {
            supports2WayAudio: true,
          },
        }),
        config: createConfig({
          menu: { buttons: { microphone: { type: 'toggle' } } },
        }),
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:microphone',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Microphone',
        style: {
          animation: 'pulse 3s infinite',
          color: 'var(--advanced-camera-card-menu-button-critical-color)',
        },
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'microphone_mute',
        },
      });
    });
  });

  describe('should have fullscreen button', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('when not in fullscreen mode', () => {
      // Need to write a readonly property.
      vi.stubGlobal('navigator', { userAgent: 'foo' });

      const fullscreenManager = mock<FullscreenManager>();
      vi.mocked(fullscreenManager.isInFullscreen).mockReturnValue(false);
      vi.mocked(fullscreenManager.isSupported).mockReturnValue(true);

      const buttons = calculateButtons(controller, { fullscreenManager });

      expect(buttons).toContainEqual({
        icon: 'mdi:fullscreen',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Fullscreen',
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'fullscreen',
        },
        style: {},
      });
    });

    it('when in fullscreen mode', () => {
      vi.stubGlobal('navigator', { userAgent: 'foo' });
      const fullscreenManager = mock<FullscreenManager>();
      vi.mocked(fullscreenManager.isInFullscreen).mockReturnValue(true);
      vi.mocked(fullscreenManager.isSupported).mockReturnValue(true);

      const buttons = calculateButtons(controller, { fullscreenManager });

      expect(buttons).toContainEqual({
        icon: 'mdi:fullscreen-exit',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Fullscreen',
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'fullscreen',
        },
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
      });
    });

    it('when not supported', () => {
      // Need to write a readonly property.
      vi.stubGlobal('navigator', { userAgent: 'foo' });
      const fullscreenManager = mock<FullscreenManager>();
      vi.mocked(fullscreenManager.isSupported).mockReturnValue(false);

      const buttons = calculateButtons(controller, { fullscreenManager });

      expect(buttons).not.toContainEqual(
        expect.objectContaining({ title: 'Fullscreen' }),
      );
    });
  });

  describe('should have expand button', () => {
    it('when not expanded', () => {
      const buttons = calculateButtons(controller, { inExpandedMode: false });

      expect(buttons).toContainEqual({
        icon: 'mdi:arrow-expand-all',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Expand',
        tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'expand' },
        style: {},
      });
    });

    it('when expanded', () => {
      const buttons = calculateButtons(controller, { inExpandedMode: true });

      expect(buttons).toContainEqual({
        icon: 'mdi:arrow-collapse-all',
        enabled: false,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-icon',
        title: 'Expand',
        tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'expand' },
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
      });
    });
  });

  describe('should have media players button', () => {
    it('with media players', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera-1',
            config: createCameraConfig({
              camera_entity: 'camera.1',
            }),
          },
        ]),
      );

      const mediaPlayerController = mock<MediaPlayerManager>();
      mediaPlayerController.hasMediaPlayers.mockReturnValue(true);
      mediaPlayerController.getMediaPlayers.mockReturnValue(['media_player.tv']);

      const buttons = calculateButtons(controller, {
        cameraManager: cameraManager,
        mediaPlayerController: mediaPlayerController,
        hass: createHASS({
          'media_player.tv': createStateEntity({ entity_id: 'media_player.tv' }),
        }),
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:cast',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-submenu',
        title: 'Send to media player',
        items: [
          {
            enabled: true,
            selected: false,
            entity: 'media_player.tv',
            state_color: false,
            title: 'media_player.tv',
            disabled: false,
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'media_player',
              media_player: 'media_player.tv',
              media_player_action: 'play',
            },
            hold_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'media_player',
              media_player: 'media_player.tv',
              media_player_action: 'stop',
            },
          },
        ],
      });
    });

    it('when entity not found', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera-1',
            config: createCameraConfig({
              camera_entity: 'camera.1',
            }),
          },
        ]),
      );
      const mediaPlayerController = mock<MediaPlayerManager>();
      mediaPlayerController.hasMediaPlayers.mockReturnValue(true);
      mediaPlayerController.getMediaPlayers.mockReturnValue(['not_a_real_player']);

      const buttons = calculateButtons(controller, {
        cameraManager: cameraManager,
        mediaPlayerController: mediaPlayerController,
        hass: createHASS(),
      });

      expect(buttons).toContainEqual({
        icon: 'mdi:cast',
        enabled: true,
        priority: 50,
        type: 'custom:advanced-camera-card-menu-submenu',
        title: 'Send to media player',
        items: [
          {
            enabled: true,
            selected: false,
            entity: 'not_a_real_player',
            state_color: false,
            title: 'not_a_real_player',
            disabled: true,
          },
        ],
      });
    });
  });

  it('should have pause button', () => {
    const mediaPlayerController = mock<MediaPlayerController>();
    const buttons = calculateButtons(controller, {
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          supportsPause: true,
        },
        mediaPlayerController,
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:pause',
      enabled: false,
      priority: 50,
      type: 'custom:advanced-camera-card-menu-icon',
      title: 'Play / Pause',
      tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'pause' },
    });
  });

  it('should have play button', () => {
    const mediaPlayerController = mock<MediaPlayerController>();
    mediaPlayerController.isPaused.mockReturnValue(true);
    const buttons = calculateButtons(controller, {
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          supportsPause: true,
        },
        mediaPlayerController,
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:play',
      enabled: false,
      priority: 50,
      type: 'custom:advanced-camera-card-menu-icon',
      title: 'Play / Pause',
      tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'play' },
    });
  });

  it('should have mute button', () => {
    const mediaPlayerController = mock<MediaPlayerController>();
    const buttons = calculateButtons(controller, {
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          hasAudio: true,
        },
        mediaPlayerController,
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:volume-high',
      enabled: false,
      priority: 50,
      type: 'custom:advanced-camera-card-menu-icon',
      title: 'Mute / Unmute',
      tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'mute' },
    });
  });

  it('should have unmute button', () => {
    const mediaPlayerController = mock<MediaPlayerController>();
    mediaPlayerController.isMuted.mockReturnValue(true);
    const buttons = calculateButtons(controller, {
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          hasAudio: true,
        },
        mediaPlayerController,
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:volume-off',
      enabled: false,
      priority: 50,
      type: 'custom:advanced-camera-card-menu-icon',
      title: 'Mute / Unmute',
      tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'unmute' },
    });
  });

  it('should have screenshot button', () => {
    const buttons = calculateButtons(controller, {
      currentMediaLoadedInfo: createMediaLoadedInfo({
        mediaPlayerController: mock<MediaPlayerController>(),
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:monitor-screenshot',
      enabled: false,
      priority: 50,
      type: 'custom:advanced-camera-card-menu-icon',
      title: 'Screenshot',
      tap_action: {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'screenshot',
      },
    });
  });

  describe('should have grid button when display mode is', () => {
    it.each([['single' as const], ['grid' as const]])(
      '%s',
      (displayMode: ViewDisplayMode) => {
        const view = createView({
          camera: 'camera-1',
          view: 'live',
          displayMode: displayMode,
        });
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore).mockReturnValue(
          createStore([
            { cameraID: 'camera-1', capabilities: createCapabilities({ live: true }) },
            { cameraID: 'camera-2', capabilities: createCapabilities({ live: true }) },
          ]),
        );

        expect(
          calculateButtons(controller, { cameraManager: cameraManager, view: view }),
        ).toContainEqual({
          icon: displayMode === 'single' ? 'mdi:grid' : 'mdi:grid-off',
          enabled: true,
          priority: 50,
          type: 'custom:advanced-camera-card-menu-icon',
          title:
            displayMode === 'grid'
              ? 'Show single media viewer'
              : 'Show media viewer for each camera in a grid',
          style:
            displayMode === 'grid'
              ? { color: 'var(--advanced-camera-card-menu-button-active-color)' }
              : {},
          tap_action: {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'display_mode_select',
            display_mode: displayMode === 'single' ? 'grid' : 'single',
          },
        });
      },
    );
  });

  describe('should have show ptz button', () => {
    it('should not show when not in live view', () => {
      const store = createStore([
        {
          cameraID: 'camera-1',
          capabilities: new Capabilities({ ptz: { left: ['relative'] } }),
        },
      ]);

      const buttons = calculateButtons(controller, {
        cameraManager: createCameraManager(store),
        view: createView({ view: 'clips' }),
      });

      expect(buttons).not.toContainEqual(
        expect.objectContaining({
          title: 'Show PTZ controls',
        }),
      );
    });

    it('should show when in live view', () => {
      const store = createStore([
        {
          cameraID: 'camera-1',
          capabilities: new Capabilities({ ptz: { left: ['relative'] } }),
        },
      ]);

      const buttons = calculateButtons(controller, {
        cameraManager: createCameraManager(store),
        view: createView({ view: 'live' }),
      });

      expect(buttons).toContainEqual(
        expect.objectContaining({
          title: 'Show PTZ controls',
        }),
      );
    });

    it('should show when the context has PTZ enabled', () => {
      const store = createStore([
        {
          cameraID: 'camera-1',
          capabilities: new Capabilities({ ptz: { left: ['relative'] } }),
        },
      ]);

      const view = createView({
        camera: 'camera-1',
        context: { ptzControls: { enabled: true } },
      });
      const buttons = calculateButtons(controller, {
        cameraManager: createCameraManager(store),
        view: view,
      });

      expect(buttons).toContainEqual({
        enabled: false,
        icon: 'mdi:pan',
        priority: 50,
        style: {
          color: 'var(--advanced-camera-card-menu-button-active-color)',
        },
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_controls',
          enabled: false,
        },
        title: 'Show PTZ controls',
        type: 'custom:advanced-camera-card-menu-icon',
      });
    });

    it('should show when the context has PTZ disabled', () => {
      const store = createStore([
        {
          cameraID: 'camera-1',
          capabilities: new Capabilities({ ptz: { left: ['relative'] } }),
        },
      ]);

      const view = createView({
        camera: 'camera-1',
        context: { ptzControls: { enabled: false } },
      });
      const buttons = calculateButtons(controller, {
        cameraManager: createCameraManager(store),
        view: view,
      });

      expect(buttons).toContainEqual({
        enabled: false,
        icon: 'mdi:pan',
        priority: 50,
        style: {},
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_controls',
          enabled: true,
        },
        title: 'Show PTZ controls',
        type: 'custom:advanced-camera-card-menu-icon',
      });
    });

    it('should detect current status without context in auto mode', () => {
      const store = createStore([
        {
          cameraID: 'camera-1',
          capabilities: new Capabilities({ ptz: { left: ['relative'] } }),
        },
      ]);

      const view = createView({
        camera: 'camera-1',
      });
      const buttons = calculateButtons(controller, {
        cameraManager: createCameraManager(store),
        config: createConfig({ live: { controls: { ptz: { mode: 'auto' } } } }),
        view: view,
      });

      expect(buttons).toContainEqual({
        enabled: false,
        icon: 'mdi:pan',
        priority: 50,
        style: {
          color: 'var(--advanced-camera-card-menu-button-active-color)',
        },
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_controls',
          enabled: false,
        },
        title: 'Show PTZ controls',
        type: 'custom:advanced-camera-card-menu-icon',
      });
    });

    it('should show when a substream is PTZ enabled', () => {
      const store = createStore([
        {
          cameraID: 'camera-1',
          config: createCameraConfig({ dependencies: { cameras: ['camera-2'] } }),
        },
        {
          cameraID: 'camera-2',
          capabilities: new Capabilities({ ptz: { left: ['relative'] } }),
        },
      ]);
      const view = createView({
        camera: 'camera-1',
        context: {
          live: {
            overrides: new Map([['camera-1', 'camera-2']]),
          },
        },
      });
      const buttons = calculateButtons(controller, {
        cameraManager: createCameraManager(store),
        view: view,
      });

      expect(buttons).toContainEqual({
        enabled: false,
        icon: 'mdi:pan',
        priority: 50,
        style: {
          color: 'var(--advanced-camera-card-menu-button-active-color)',
        },
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_controls',
          enabled: false,
        },
        title: 'Show PTZ controls',
        type: 'custom:advanced-camera-card-menu-icon',
      });
    });
  });

  describe('should have ptz home button', () => {
    it.each([
      ['live' as const, true, false],
      ['live' as const, undefined, false],
      ['live' as const, false, true],
      ['media' as const, true, false],
      ['media' as const, undefined, false],
      ['media' as const, false, true],
    ])(
      '%s view with isDefault %s',
      (
        viewName: AdvancedCameraCardView,
        isDefault: boolean | undefined,
        expectedResult: boolean,
      ) => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore).mockReturnValue(
          createStore([{ cameraID: 'camera-1' }]),
        );

        const targetID = viewName === 'live' ? 'camera-1' : 'media-1';
        const view = createView({
          view: viewName,
          camera: 'camera-1',
          queryResults: new MediaQueriesResults({
            results: [new TestViewMedia({ id: 'media-1' })],
            selectedIndex: 0,
          }),
          ...(isDefault !== undefined && {
            context: {
              zoom: {
                [targetID]: {
                  observed: {
                    isDefault: isDefault,
                    unzoomed: false,
                    zoom: 1,
                    pan: {
                      x: 50,
                      y: 50,
                    },
                  },
                },
              },
            },
          }),
        });
        const buttons = calculateButtons(controller, {
          cameraManager: cameraManager,
          view: view,
        });

        if (expectedResult) {
          expect(buttons).toContainEqual({
            enabled: false,
            icon: 'mdi:home',
            priority: 50,
            tap_action: {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'ptz_multi',
              target_id: targetID,
            },
            title: 'PTZ Home',
            type: 'custom:advanced-camera-card-menu-icon',
          });
        } else {
          expect(buttons).not.toContainEqual(
            expect.objectContaining({ title: 'PTZ Home' }),
          );
        }
      },
    );
  });

  describe('should handle dynamic buttons', () => {
    it('successfully', () => {
      const button: MenuItem = {
        ...dynamicButton,
        style: {},
      };
      controller.addDynamicMenuButton(button);

      expect(
        calculateButtons(controller).filter((menuButton) => isEqual(button, menuButton))
          .length,
      ).toBe(1);

      // Adding it again will have no effect.
      controller.addDynamicMenuButton(button);
      expect(
        calculateButtons(controller).filter((menuButton) => isEqual(button, menuButton))
          .length,
      ).toBe(1);

      controller.removeDynamicMenuButton(button);
      expect(calculateButtons(controller)).not.toContainEqual(button);
    });

    it('with stock HA action', () => {
      const button: MenuItem = {
        ...dynamicButton,
        tap_action: { action: 'navigate', navigation_path: 'foo' },
      };
      controller.addDynamicMenuButton(button);

      expect(calculateButtons(controller)).toContainEqual({
        ...button,
        style: {},
      });
    });

    it('with non-advanced-camera-card fire-dom-event action', () => {
      const button: MenuItem = {
        ...dynamicButton,
        tap_action: { action: 'fire-dom-event' },
      };
      controller.addDynamicMenuButton(button);
      controller.addDynamicMenuButton(dynamicButton);

      expect(calculateButtons(controller)).toContainEqual({
        ...button,
        style: {},
      });
    });

    it('with advanced camera card view action', () => {
      const button: MenuItem = {
        ...dynamicButton,
        tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'clips' },
      };
      const view = createView({ view: 'clips' });
      controller.addDynamicMenuButton(button);

      expect(calculateButtons(controller, { view: view })).toContainEqual({
        ...button,
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
      });
    });

    it('with advanced camera card default action', () => {
      const button: MenuItem = {
        ...dynamicButton,
        tap_action: { action: 'fire-dom-event', advanced_camera_card_action: 'default' },
      };
      controller.addDynamicMenuButton(button);

      expect(calculateButtons(controller)).toContainEqual({
        ...button,
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
      });
    });

    it('with fullscreen action', () => {
      const button: MenuItem = {
        ...dynamicButton,
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'fullscreen',
        },
      };
      controller.addDynamicMenuButton(button);
      const fullscreenManager = mock<FullscreenManager>();
      vi.mocked(fullscreenManager.isInFullscreen).mockReturnValue(true);
      vi.mocked(fullscreenManager.isSupported).mockReturnValue(true);

      expect(calculateButtons(controller, { fullscreenManager })).toContainEqual({
        ...button,
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
      });
    });

    it('with camera_select action', () => {
      const button: MenuItem = {
        ...dynamicButton,
        tap_action: {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'camera_select',
          camera: 'foo',
        },
      };
      const view = createView({ camera: 'foo' });
      controller.addDynamicMenuButton(button);

      expect(calculateButtons(controller, { view: view })).toContainEqual({
        ...button,
        style: { color: 'var(--advanced-camera-card-menu-button-active-color)' },
      });
    });

    it('with array of actions', () => {
      const button: MenuItem = {
        ...dynamicButton,
        tap_action: [
          { action: 'fire-dom-event' },
          { action: 'fire-dom-event', advanced_camera_card_action: 'clips' },
        ],
      };
      const view = createView({ camera: 'clips' });
      controller.addDynamicMenuButton(button);

      expect(calculateButtons(controller, { view: view })).toContainEqual({
        ...button,
        style: {},
      });
    });
  });
});
