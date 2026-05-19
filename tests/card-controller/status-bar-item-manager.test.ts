import { describe, expect, it, vi } from 'vitest';
import { StatusBarItemManager } from '../../src/card-controller/status-bar-item-manager';
import { StatusBarString } from '../../src/config/schema/actions/types';
import { QueryResults } from '../../src/view/query-results';
import {
  TestViewMedia,
  createCameraManager,
  createCardAPI,
  createStore,
  createView,
} from '../test-utils';

describe('StatusBarItemManager', () => {
  const testItem: StatusBarString = {
    type: 'custom:advanced-camera-card-status-bar-string' as const,
    string: 'test',
  };

  it('should add', () => {
    const manager = new StatusBarItemManager(createCardAPI());
    manager.addDynamicStatusBarItem(testItem);
    manager.addDynamicStatusBarItem(testItem);

    expect(manager.calculateItems()).toEqual([testItem]);
  });

  it('should remove', () => {
    const manager = new StatusBarItemManager(createCardAPI());
    manager.addDynamicStatusBarItem(testItem);

    manager.removeDynamicStatusBarItem({ ...testItem });
    expect(manager.calculateItems()).not.toContain(testItem);

    manager.removeDynamicStatusBarItem({ ...testItem, string: 'not-present' });
    expect(manager.calculateItems()).not.toContain({
      ...testItem,
      string: 'not-present',
    });
  });

  it('should remove all', () => {
    const manager = new StatusBarItemManager(createCardAPI());
    manager.addDynamicStatusBarItem(testItem);
    manager.removeAllDynamicStatusBarItems();
    expect(manager.calculateItems()).not.toContain(testItem);
  });

  describe('should have standard status bar items', () => {
    describe('should have title', () => {
      describe('live', () => {
        it('should show with metadata', () => {
          const manager = new StatusBarItemManager(createCardAPI());
          const store = createStore([
            {
              cameraID: 'camera-1',
            },
          ]);
          const cameraManager = createCameraManager(store);
          vi.mocked(cameraManager.getCameraMetadata).mockReturnValue({
            title: 'Camera Title',
            icon: { icon: 'mdi:camera' },
          });

          expect(
            manager.calculateItems({
              cameraManager: cameraManager,
              view: createView({ view: 'live', camera: 'camera-1' }),
            }),
          ).toContainEqual({
            type: 'custom:advanced-camera-card-status-bar-string' as const,
            string: 'Camera Title',
            expand: true,
            sufficient: true,
          });
        });

        it('should handle without metadata', () => {
          const manager = new StatusBarItemManager(createCardAPI());
          const cameraManager = createCameraManager();
          expect(
            manager.calculateItems({
              cameraManager: cameraManager,
              view: createView({ view: 'live', camera: 'MISSING-CAMERA' }),
            }),
          ).not.toContainEqual(expect.objectContaining({ sufficient: true }));
        });
      });

      describe('media', () => {
        it('should show with a title', () => {
          const manager = new StatusBarItemManager(createCardAPI());
          const cameraManager = createCameraManager();

          const media = [new TestViewMedia({ title: 'Media Title' })];
          const queryResults = new QueryResults({
            results: media,
          });

          const view = createView({
            view: 'media',
            queryResults: queryResults,
          });

          expect(
            manager.calculateItems({
              cameraManager: cameraManager,
              view: view,
            }),
          ).toContainEqual({
            type: 'custom:advanced-camera-card-status-bar-string' as const,
            string: 'Media Title',
            expand: true,
            sufficient: true,
          });
        });

        it('should handle without a title', () => {
          const manager = new StatusBarItemManager(createCardAPI());
          const cameraManager = createCameraManager();

          const media = [new TestViewMedia()];
          const queryResults = new QueryResults({
            results: media,
          });

          const view = createView({
            view: 'media',
            queryResults: queryResults,
          });

          expect(
            manager.calculateItems({
              cameraManager: cameraManager,
              view: view,
            }),
          ).not.toContainEqual(expect.objectContaining({ sufficient: true }));
        });
      });
    });

    describe('should have resolution', () => {
      it.each([
        ['1080p landscape', '1080p', 1920, 1080],
        ['1080p portrait', '1080p', 1080, 1920],
        ['1080p approximate', '1080p', 1922, 1082],

        ['720p landscape', '720p', 1280, 720],
        ['720p portrait', '720p', 720, 1280],
        ['720p approximate', '720p', 1282, 722],

        ['VGA landscape', 'VGA', 640, 480],
        ['VGA portrait', 'VGA', 480, 640],
        ['VGA approximate', 'VGA', 642, 482],

        ['4K landscape', '4K', 3840, 2160],
        ['4K portrait', '4K', 2160, 3840],
        ['4K approximate', '4K', 3842, 2162],

        ['480p landscape', '480p', 720, 480],
        ['480p portrait', '480p', 480, 720],
        ['480p approximate', '480p', 722, 482],

        ['576p landscape', '576p', 720, 576],
        ['576p portrait', '576p', 576, 720],
        ['576p approximate', '576p', 722, 578],

        ['8K landscape', '8K', 7680, 4320],
        ['8K portrait', '8K', 4320, 7680],
        ['8K approximate', '8K', 7682, 4322],

        ['random', '123x456', 123, 456],
      ])(
        '%s',
        (_testName: string, expectedName: string, width: number, height: number) => {
          const manager = new StatusBarItemManager(createCardAPI());

          expect(
            manager.calculateItems({
              mediaLoadedInfo: { width, height },
            }),
          ).toContainEqual({
            type: 'custom:advanced-camera-card-status-bar-string' as const,
            string: expectedName,
          });
        },
      );
    });

    describe('should have technology', () => {
      it('should show webrtc icon', () => {
        const manager = new StatusBarItemManager(createCardAPI());

        expect(
          manager.calculateItems({
            mediaLoadedInfo: { width: 640, height: 480, technology: ['webrtc'] },
          }),
        ).toContainEqual({
          type: 'custom:advanced-camera-card-status-bar-icon' as const,
          icon: 'mdi:webrtc',
        });
      });

      it('should show non-webrtc string', () => {
        const manager = new StatusBarItemManager(createCardAPI());

        expect(
          manager.calculateItems({
            mediaLoadedInfo: { width: 640, height: 480, technology: ['hls'] },
          }),
        ).toContainEqual({
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'HLS',
        });
      });
    });

    it('should have engine', () => {
      const manager = new StatusBarItemManager(createCardAPI());
      const store = createStore([
        {
          cameraID: 'camera-1',
        },
      ]);
      const cameraManager = createCameraManager(store);
      vi.mocked(cameraManager.getCameraMetadata).mockReturnValue({
        title: 'Camera Title',
        icon: {
          icon: 'mdi:camera',
        },
        engineIcon: 'ENGINE_ICON',
      });

      expect(
        manager.calculateItems({
          cameraManager: cameraManager,
          view: createView({ view: 'live', camera: 'camera-1' }),
        }),
      ).toContainEqual({
        type: 'custom:advanced-camera-card-status-bar-icon' as const,
        icon: 'ENGINE_ICON',
      });
    });

    describe('issues', () => {
      it('should show issue items', () => {
        const manager = new StatusBarItemManager(createCardAPI());

        const items = manager.calculateItems({
          issues: [
            {
              key: 'config_upgrade',
              issue: {
                icon: 'mdi:update',
                severity: 'medium',
                notification: {
                  heading: {
                    text: 'Upgrade available',
                    icon: 'mdi:update',
                    severity: 'medium',
                  },
                  body: { text: 'Upgrade text' },
                },
              },
            },
          ],
        });

        expect(items).toContainEqual(
          expect.objectContaining({
            type: 'custom:advanced-camera-card-status-bar-icon' as const,
            icon: 'mdi:update',
            severity: 'medium',
            title: 'Upgrade available',
            actions: expect.objectContaining({
              tap_action: expect.objectContaining({
                action: 'fire-dom-event',
                advanced_camera_card_action: 'notification',
              }),
            }),
          }),
        );
      });

      it('should not show issue items when empty', () => {
        const manager = new StatusBarItemManager(createCardAPI());

        const items = manager.calculateItems({
          issues: [],
        });

        expect(items).not.toContainEqual(
          expect.objectContaining({
            icon: 'mdi:update',
          }),
        );
      });

      it('should not show issue items by default', () => {
        const manager = new StatusBarItemManager(createCardAPI());

        const items = manager.calculateItems();

        expect(items).not.toContainEqual(
          expect.objectContaining({
            icon: 'mdi:update',
          }),
        );
      });

      it('should filter out all issues when disabled', () => {
        const manager = new StatusBarItemManager(createCardAPI());

        const items = manager.calculateItems({
          statusConfig: {
            auto_hide: [],
            position: 'bottom',
            style: 'popup',
            popup_seconds: 3,
            height: 40,
            items: {
              engine: { enabled: true, priority: 50 },
              issues: { enabled: false, priority: 50 },
              resolution: { enabled: true, priority: 50 },
              severity: { enabled: true, priority: 50 },
              technology: { enabled: true, priority: 50 },
              title: { enabled: true, priority: 50 },
            },
          },
          issues: [
            {
              key: 'config_upgrade',
              issue: {
                icon: 'mdi:update',
                severity: 'medium',
                notification: {
                  heading: {
                    text: 'Upgrade available',
                    icon: 'mdi:update',
                    severity: 'medium',
                  },
                  body: { text: 'Upgrade text' },
                },
              },
            },
          ],
        });

        expect(items).not.toContainEqual(
          expect.objectContaining({
            icon: 'mdi:update',
          }),
        );
      });

      it('should apply config overrides to issue items', () => {
        const manager = new StatusBarItemManager(createCardAPI());

        const items = manager.calculateItems({
          statusConfig: {
            auto_hide: [],
            position: 'bottom',
            style: 'popup',
            popup_seconds: 3,
            height: 40,
            items: {
              engine: { enabled: true, priority: 50 },
              issues: { enabled: true, priority: 90 },
              resolution: { enabled: true, priority: 50 },
              severity: { enabled: true, priority: 50 },
              technology: { enabled: true, priority: 50 },
              title: { enabled: true, priority: 50 },
            },
          },
          issues: [
            {
              key: 'config_upgrade',
              issue: {
                icon: 'mdi:update',
                severity: 'medium',
                notification: {
                  heading: {
                    text: 'Upgrade available',
                    icon: 'mdi:update',
                    severity: 'medium',
                  },
                  body: { text: 'Upgrade text' },
                },
              },
            },
          ],
        });

        expect(items).toContainEqual(
          expect.objectContaining({
            icon: 'mdi:update',
            priority: 90,
          }),
        );
      });
    });

    describe('severity', () => {
      it('should have severity in a viewer view', () => {
        const manager = new StatusBarItemManager(createCardAPI());
        const selectedResult = new TestViewMedia({
          cameraID: 'camera-1',
        });
        vi.spyOn(selectedResult, 'getSeverity').mockReturnValue('high');

        const queryResults = new QueryResults({
          results: [selectedResult],
          selectedIndex: 0,
        });

        expect(
          manager.calculateItems({
            view: createView({ view: 'media', queryResults: queryResults }),
          }),
        ).toContainEqual({
          type: 'custom:advanced-camera-card-status-bar-icon' as const,
          icon: 'mdi:circle-medium',
          severity: 'high',
        });
      });

      it('should not have severity in live view', () => {
        const manager = new StatusBarItemManager(createCardAPI());
        const selectedResult = new TestViewMedia({
          cameraID: 'camera-1',
        });
        vi.spyOn(selectedResult, 'getSeverity').mockReturnValue('high');

        const queryResults = new QueryResults({
          results: [selectedResult],
          selectedIndex: 0,
        });

        expect(
          manager.calculateItems({
            view: createView({ view: 'live', queryResults: queryResults }),
          }),
        ).not.toContainEqual(
          expect.objectContaining({
            icon: 'mdi:circle-medium',
          }),
        );
      });
    });
  });
});
