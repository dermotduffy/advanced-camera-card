import type { ViewContext } from 'view';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { PTZDigitalAction } from '../../../../src/card-controller/actions/actions/ptz-digital';
import type { Action } from '../../../../src/card-controller/actions/types';
import type { CardController } from '../../../../src/card-controller/controller';
import type {
  PartialZoomSettings,
  ZoomSettingsObserved,
} from '../../../../src/components-lib/zoom/types';
import type { PTZAction } from '../../../../src/config/schema/actions/custom/ptz';
import { applySetViewModifiers } from '../../../card-controller/view/test-utils';
import { createCardAPI } from '../../../test-utils';
import { createView } from '../../../view/test-utils';

const getRequestedZoom = (
  api: CardController,
  context?: ViewContext,
  n = 0,
): PartialZoomSettings | null | undefined =>
  applySetViewModifiers(api.getViewManager(), createView({ context }), n).context?.zoom
    ?.camera?.requested;

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

    expect(getRequestedZoom(api)).toEqual({
      pan: {
        x: 3,
        y: 4,
      },
      zoom: 2,
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

    expect(getRequestedZoom(api)).toEqual({});
  });

  // See: https://github.com/dermotduffy/advanced-camera-card/issues/2632
  it('should return to default when chained after an absolute request', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

    await new PTZDigitalAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        absolute: {
          zoom: 3,
        },
      },
    ).execute(api);

    await new PTZDigitalAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
      },
    ).execute(api);

    // Both actions land on a single view, as they do when an automation runs
    // them back to back.
    const view = createView();
    applySetViewModifiers(api.getViewManager(), view, 0);
    applySetViewModifiers(api.getViewManager(), view, 1);

    expect(view.context?.zoom?.camera?.requested).toEqual({});
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

    expect(api.getViewManager().setViewWithModifiers).not.toHaveBeenCalled();
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

    expect(api.getViewManager().setViewWithModifiers).not.toHaveBeenCalled();
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

        expect(
          getRequestedZoom(api, { zoom: { camera: { observed: current } } }),
        ).toEqual({
          ...defaultSettings,
          ...expectedSettings,
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

      expect(getRequestedZoom(api)).toEqual({
        ...defaultSettings,
        pan: {
          x: 55,
          y: 50,
        },
      });

      // Update the context to reflect the first step.
      const observed = createObserved({
        pan: {
          x: 55,
          y: 50,
        },
      });
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({ context: { zoom: { camera: { observed } } } }),
      );

      vi.runOnlyPendingTimers();

      expect(getRequestedZoom(api, { zoom: { camera: { observed } } }, 1)).toEqual({
        ...defaultSettings,
        pan: {
          x: 60,
          y: 50,
        },
      });
      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(2);

      action.stop();
      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(2);
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

      expect(getRequestedZoom(api)).toEqual({
        ...defaultSettings,
        pan: {
          x: 55,
          y: 50,
        },
      });
      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(1);

      const stopAction = new PTZDigitalAction(context, {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_phase: 'stop',
      });
      await stopAction.execute(api);

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(1);
    });

    it('should stop without anything in progress', async () => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

      const stopAction = new PTZDigitalAction(
        {},
        {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_digital',
          ptz_phase: 'stop',
        },
      );
      await stopAction.execute(api);

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewWithModifiers).not.toHaveBeenCalled();
    });

    it('should only move for the latest of two concurrent starts', async () => {
      const api = createCardAPI();
      const context = {};
      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

      const createStartAction = (ptzAction: PTZAction): PTZDigitalAction =>
        new PTZDigitalAction(context, {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_digital',
          ptz_action: ptzAction,
          ptz_phase: 'start',
        });

      await Promise.all([
        createStartAction('left').execute(api),
        createStartAction('up').execute(api),
      ]);

      // The 'up' start replaces the 'left' start before the 'left' start has
      // taken its first step, so only the 'up' start moves.
      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(1);
      expect(getRequestedZoom(api)).toEqual({
        ...defaultSettings,
        pan: {
          x: 50,
          y: 45,
        },
      });

      const stopAction = new PTZDigitalAction(context, {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_phase: 'stop',
      });
      await stopAction.execute(api);

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(1);
    });

    it('should continue movement when a stop for a different movement arrives', async () => {
      const api = createCardAPI();
      const context = {};
      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

      const leftAction = new PTZDigitalAction(context, {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_action: 'left',
        ptz_phase: 'start',
      });
      await leftAction.execute(api);

      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(1);
      expect(getRequestedZoom(api)).toEqual({
        ...defaultSettings,
        pan: {
          x: 45,
          y: 50,
        },
      });

      // A stop for a movement that is not in progress leaves the 'left'
      // movement running.
      const stopUpAction = new PTZDigitalAction(context, {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_action: 'up',
        ptz_phase: 'stop',
      });
      await stopUpAction.execute(api);

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(2);

      const stopLeftAction = new PTZDigitalAction(context, {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_action: 'left',
        ptz_phase: 'stop',
      });
      await stopLeftAction.execute(api);

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(2);
    });

    it('should not stop an in-progress action that is not a digital PTZ action', async () => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

      const incumbent = mock<Action>();
      const context = { ptzDigital: { camera: { inProgressAction: incumbent } } };

      const stopAction = new PTZDigitalAction(context, {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_action: 'left',
        ptz_phase: 'stop',
      });
      await stopAction.execute(api);

      expect(incumbent.stop).not.toHaveBeenCalled();
    });

    it('should not repeat steps when stopped during the first step', async () => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

      const action = new PTZDigitalAction(
        {},
        {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_digital',
          ptz_action: 'left',
          ptz_phase: 'start',
        },
      );

      // The stop arrives while the first step is being taken.
      vi.mocked(api.getViewManager().setViewWithModifiers).mockImplementationOnce(() => {
        action.stop();
      });

      await action.execute(api);

      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(1);

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(1);
    });

    it('should continue movement when a start is concurrent with a stop', async () => {
      const api = createCardAPI();
      const context = {};
      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

      const leftAction = new PTZDigitalAction(context, {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_action: 'left',
        ptz_phase: 'start',
      });
      await leftAction.execute(api);

      const stopAction = new PTZDigitalAction(context, {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_phase: 'stop',
      });
      const upAction = new PTZDigitalAction(context, {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_digital',
        ptz_action: 'up',
        ptz_phase: 'start',
      });

      // The left key is released as the up key is pressed.
      await Promise.all([stopAction.execute(api), upAction.execute(api)]);

      // One step for the left start, one for the up start.
      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(2);

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewWithModifiers).toHaveBeenCalledTimes(3);
    });
  });
});
