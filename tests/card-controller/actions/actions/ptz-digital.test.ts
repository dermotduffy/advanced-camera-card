import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PTZDigitalAction } from '../../../../src/card-controller/actions/actions/ptz-digital';
import {
  PartialZoomSettings,
  ZoomSettingsObserved,
} from '../../../../src/components-lib/zoom/types';
import { PTZAction } from '../../../../src/config/schema/actions/custom/ptz';
import { createCardAPI, createView } from '../../../test-utils';

describe('should handle ptz digital action', () => {
  const defaultSettings = {
    pan: {
      x: 50,
      y: 50,
    },
    zoom: 1,
  };

  const createObserved = (
    observed?: Partial<ZoomSettingsObserved>,
  ): ZoomSettingsObserved => ({
    ...defaultSettings,
    isDefault: true,
    unzoomed: true,
    ...observed,
  });

  it('should honor absolute parameters', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

    const action = new PTZDigitalAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        absolute: {
          zoom: 2,
          pan: {
            x: 3,
            y: 4,
          },
        },
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
      zoom: {
        camera: {
          observed: undefined,
          requested: {
            pan: {
              x: 3,
              y: 4,
            },
            zoom: 2,
          },
        },
      },
    });
  });

  it('should return to default without absolute parameters or action', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

    const action = new PTZDigitalAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
      zoom: {
        camera: {
          observed: undefined,
          requested: {},
        },
      },
    });
  });

  it('should do nothing without a view', async () => {
    const api = createCardAPI();

    const action = new PTZDigitalAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_action: 'left',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewWithMergedContext).not.toBeCalledWith();
  });

  it('should do nothing without a camera', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        // There is no media associated with a timeline, so there's no camera to
        // change the PTZ settings for.
        view: 'timeline',
      }),
    );

    const action = new PTZDigitalAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_action: 'left',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewWithMergedContext).not.toBeCalled();
  });

  describe('should honor ptz_action', () => {
    it.each([
      [
        'zoom_in',
        'zoom_in' as const,
        {
          zoom: 1.1,
        },
        createObserved(),
      ],
      [
        'zoom_in at maximum zoom',
        'zoom_in' as const,
        {
          zoom: 10,
        },
        createObserved({
          zoom: 10,
        }),
      ],
      [
        'zoom_out',
        'zoom_out' as const,
        {
          zoom: 1.9,
        },
        createObserved({
          zoom: 2,
        }),
      ],
      [
        'zoom_out at minimum zoom',
        'zoom_out' as const,
        {
          zoom: 1,
        },
        createObserved({
          zoom: 1,
        }),
      ],
      [
        'left',
        'left' as const,
        {
          pan: {
            x: 45,
            y: 50,
          },
        },
        createObserved({
          pan: {
            x: 50,
            y: 50,
          },
        }),
      ],
      [
        'left at left edge',
        'left' as const,
        {
          pan: {
            x: 0,
            y: 50,
          },
        },
        createObserved({
          pan: {
            x: 0,
            y: 50,
          },
        }),
      ],
      [
        'right',
        'right' as const,
        {
          pan: {
            x: 55,
            y: 50,
          },
        },
        createObserved({
          pan: {
            x: 50,
            y: 50,
          },
        }),
      ],
      [
        'right at right edge',
        'right' as const,
        {
          pan: {
            x: 100,
            y: 50,
          },
        },
        createObserved({
          pan: {
            x: 100,
            y: 50,
          },
        }),
      ],
      [
        'up',
        'up' as const,
        {
          pan: {
            x: 50,
            y: 45,
          },
        },
        createObserved({
          pan: {
            x: 50,
            y: 50,
          },
        }),
      ],
      [
        'up at top edge',
        'up' as const,
        {
          pan: {
            x: 50,
            y: 0,
          },
        },
        createObserved({
          pan: {
            x: 50,
            y: 0,
          },
        }),
      ],
      [
        'down',
        'down' as const,
        {
          pan: {
            x: 50,
            y: 55,
          },
        },
        createObserved({
          pan: {
            x: 50,
            y: 50,
          },
        }),
      ],
      [
        'down at bottom edge',
        'down' as const,
        {
          pan: {
            x: 50,
            y: 100,
          },
        },
        createObserved({
          pan: {
            x: 50,
            y: 100,
          },
        }),
      ],
      [
        'action with undefined observed',
        'down' as const,
        {
          pan: {
            x: 50,
            y: 55,
          },
        },
      ],
    ])(
      '%s',
      async (
        _testTitle: string,
        ptzAction: PTZAction,
        expectedSettings: PartialZoomSettings,
        current?: ZoomSettingsObserved,
      ) => {
        const api = createCardAPI();
        vi.mocked(api.getViewManager().getView).mockReturnValue(
          createView({
            context: {
              zoom: {
                camera: {
                  observed: current,
                },
              },
            },
          }),
        );

        const action = new PTZDigitalAction(
          {},
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'ptz_digital',
            ptz_action: ptzAction,
          },
        );

        await action.execute(api);

        expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
          zoom: {
            camera: {
              observed: undefined,
              requested: {
                ...defaultSettings,
                ...expectedSettings,
              },
            },
          },
        });
      },
    );
  });

  // @vitest-environment jsdom
  describe('should honor ptz_phase', () => {
    beforeAll(() => {
      vi.useFakeTimers();
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it('start', async () => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

      const action = new PTZDigitalAction(
        {},
        {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_digital',
          ptz_action: 'right',
          ptz_phase: 'start',
        },
      );

      await action.execute(api);

      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenLastCalledWith({
        zoom: {
          camera: {
            observed: undefined,
            requested: {
              ...defaultSettings,
              pan: {
                x: 55,
                y: 50,
              },
            },
          },
        },
      });

      // Update the context to reflect the first step.
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          context: {
            zoom: {
              camera: {
                observed: createObserved({
                  pan: {
                    x: 55,
                    y: 50,
                  },
                }),
              },
            },
          },
        }),
      );

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenLastCalledWith({
        zoom: {
          camera: {
            observed: undefined,
            requested: {
              ...defaultSettings,
              pan: {
                x: 60,
                y: 50,
              },
            },
          },
        },
      });
      expect(api.getViewManager().setViewWithMergedContext).toBeCalledTimes(2);

      action.stop();
      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewWithMergedContext).toBeCalledTimes(2);
    });

    it('stop', async () => {
      const api = createCardAPI();
      const context = {};
      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

      const startAction = new PTZDigitalAction(context, {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_action: 'right',
        ptz_phase: 'start',
      });
      await startAction.execute(api);

      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenLastCalledWith({
        zoom: {
          camera: {
            observed: undefined,
            requested: {
              ...defaultSettings,
              pan: {
                x: 55,
                y: 50,
              },
            },
          },
        },
      });
      expect(api.getViewManager().setViewWithMergedContext).toBeCalledTimes(1);

      const stopAction = new PTZDigitalAction(context, {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_phase: 'stop',
      });
      await stopAction.execute(api);

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewWithMergedContext).toBeCalledTimes(1);
    });
  });
});
