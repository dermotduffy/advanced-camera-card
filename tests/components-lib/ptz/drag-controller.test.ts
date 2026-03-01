import { createGesture } from '@use-gesture/vanilla';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchActionExecutionRequest } from '../../../src/card-controller/actions/utils/execution-request.js';
import { PTZDragController } from '../../../src/components-lib/ptz/drag-controller';
import {
  PTZAction,
  PTZActionPhase,
} from '../../../src/config/schema/actions/custom/ptz';
import { createPTZAction } from '../../../src/utils/action';
import { createLitElement } from '../../test-utils';

vi.mock('@use-gesture/vanilla', () => ({
  createGesture: vi.fn(),
  dragAction: Symbol('dragAction'),
  pinchAction: Symbol('pinchAction'),
  wheelAction: Symbol('wheelAction'),
}));

vi.mock('../../../src/card-controller/actions/utils/execution-request.js', () => ({
  dispatchActionExecutionRequest: vi.fn(),
}));

const ptzAction = (ptzAction: PTZAction, ptzPhase?: PTZActionPhase) => ({
  actions: createPTZAction({ ptzAction, ptzPhase }),
});

// @vitest-environment jsdom
describe('PTZDragController', () => {
  const destroy = vi.fn();
  const gestureInit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    gestureInit.mockReturnValue({ destroy });
    vi.mocked(createGesture).mockReturnValue(gestureInit);
  });

  const getHandlers = () =>
    gestureInit.mock.calls[0][1] as unknown as Record<
      string,
      (...args: unknown[]) => void
    >;

  it('should register as a controller on the host', () => {
    const host = createLitElement();
    new PTZDragController(host);
    expect(host.addController).toBeCalled();
  });

  describe('activation', () => {
    it('should activate and request host update', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      const element = document.createElement('div');
      controller.activateIfNecessary(element);

      expect(host.requestUpdate).toBeCalled();
    });

    it('should set cursor and touch-action styles on the element', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      const element = document.createElement('div');
      controller.activateIfNecessary(element);

      expect(element.style.cursor).toBe('grab');
      expect(element.style.touchAction).toBe('none');
    });

    it('should preserve existing styles for restoration', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      const element = document.createElement('div');
      element.style.cursor = 'pointer';
      element.style.touchAction = 'auto';

      controller.activateIfNecessary(element);
      controller.deactivateIfNecessary();

      expect(element.style.cursor).toBe('pointer');
      expect(element.style.touchAction).toBe('auto');
    });

    it('should not activate twice', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      const element = document.createElement('div');
      controller.activateIfNecessary(element);
      controller.activateIfNecessary(element);

      expect(createGesture).toBeCalledTimes(1);
    });

    it('should create gesture with drag, pinch, and wheel actions', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      expect(createGesture).toBeCalled();
    });
  });

  describe('deactivation', () => {
    it('should deactivate and request host update', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      const element = document.createElement('div');
      controller.activateIfNecessary(element);
      vi.mocked(host.requestUpdate).mockClear();

      controller.deactivateIfNecessary();

      expect(host.requestUpdate).toBeCalled();
    });

    it('should destroy the gesture recognizer', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));
      controller.deactivateIfNecessary();

      expect(destroy).toBeCalled();
    });

    it('should not deactivate when not active', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.deactivateIfNecessary();

      expect(host.requestUpdate).not.toBeCalled();
    });

    it('should stop active directions on deactivation', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onDrag({
        pinching: false,
        last: false,
        movement: [110, -110],
      });
      vi.mocked(dispatchActionExecutionRequest).mockClear();

      controller.deactivateIfNecessary();

      expect(dispatchActionExecutionRequest).toBeCalledWith(
        host,
        ptzAction('left', 'stop'),
      );
      expect(dispatchActionExecutionRequest).toBeCalledWith(
        host,
        ptzAction('down', 'stop'),
      );
    });

    it('should stop active zoom on deactivation', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onPinch({ direction: [1], last: false });
      vi.mocked(dispatchActionExecutionRequest).mockClear();

      controller.deactivateIfNecessary();

      expect(dispatchActionExecutionRequest).toBeCalledWith(
        host,
        ptzAction('zoom_in', 'stop'),
      );
    });
  });

  describe('hostDisconnected', () => {
    it('should deactivate when host disconnects', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));
      controller.hostDisconnected();

      expect(destroy).toBeCalled();
    });
  });

  describe('drag', () => {
    describe('continuous mode', () => {
      it('should start continuous PTZ left when dragging right', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [110, 0],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('left', 'start'),
        );
      });

      it('should start continuous PTZ right when dragging left', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [-110, 0],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('right', 'start'),
        );
      });

      it('should start continuous PTZ up when dragging down', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [0, 110],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('up', 'start'),
        );
      });

      it('should start continuous PTZ down when dragging up', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [0, -110],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('down', 'start'),
        );
      });

      it('should start both axes for diagonal drag', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [110, -110],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('left', 'start'),
        );
        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('down', 'start'),
        );
      });

      it('should not re-dispatch when direction is unchanged', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [110, 0],
        });
        vi.mocked(dispatchActionExecutionRequest).mockClear();

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [120, 0],
        });

        expect(dispatchActionExecutionRequest).not.toBeCalled();
      });

      it('should stop old and start new on X direction reversal', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [110, 0],
        });
        vi.mocked(dispatchActionExecutionRequest).mockClear();

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [-110, 0],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('left', 'stop'),
        );
        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('right', 'start'),
        );
      });

      it('should stop old and start new on Y direction reversal', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [0, 110],
        });
        vi.mocked(dispatchActionExecutionRequest).mockClear();

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [0, -110],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('up', 'stop'),
        );
        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('down', 'start'),
        );
      });

      it('should stop direction when axis returns to zero', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [110, 110],
        });
        vi.mocked(dispatchActionExecutionRequest).mockClear();

        // Movement returns to zero on both axes.
        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [0, 0],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('left', 'stop'),
        );
        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('up', 'stop'),
        );
        expect(dispatchActionExecutionRequest).toBeCalledTimes(2);
      });

      it('should stop active directions on drag end', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [110, -110],
        });
        vi.mocked(dispatchActionExecutionRequest).mockClear();

        getHandlers().onDrag({
          pinching: false,
          last: true,
          movement: [110, -110],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('left', 'stop'),
        );
        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('down', 'stop'),
        );
      });

      it('should not dispatch relative on drag end after continuous', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [110, 0],
        });
        vi.mocked(dispatchActionExecutionRequest).mockClear();

        getHandlers().onDrag({
          pinching: false,
          last: true,
          movement: [110, 0],
        });

        // Only the stop is dispatched, not a relative action.
        expect(dispatchActionExecutionRequest).toBeCalledTimes(1);
        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('left', 'stop'),
        );
      });
    });

    describe('relative mode', () => {
      it('should not dispatch during small drag', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [30, -20],
        });

        expect(dispatchActionExecutionRequest).not.toBeCalled();
      });

      it('should dispatch relative left and down on small drag end', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [30, -20],
        });
        getHandlers().onDrag({
          pinching: false,
          last: true,
          movement: [30, -20],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(host, ptzAction('left'));
        expect(dispatchActionExecutionRequest).toBeCalledWith(host, ptzAction('down'));
      });

      it('should dispatch relative right and up on small drag end', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [-30, 20],
        });
        getHandlers().onDrag({
          pinching: false,
          last: true,
          movement: [-30, 20],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(host, ptzAction('right'));
        expect(dispatchActionExecutionRequest).toBeCalledWith(host, ptzAction('up'));
      });

      it('should not dispatch relative on zero movement', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: true,
          movement: [0, 0],
        });

        expect(dispatchActionExecutionRequest).not.toBeCalled();
      });
    });

    describe('pinch cancels drag', () => {
      it('should ignore drag events while pinching', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: true,
          last: false,
          movement: [80, 80],
        });

        expect(dispatchActionExecutionRequest).not.toBeCalled();
      });

      it('should stop active continuous directions when pinch starts', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [110, 0],
        });
        vi.mocked(dispatchActionExecutionRequest).mockClear();

        getHandlers().onDrag({
          pinching: true,
          last: false,
          movement: [120, 0],
        });

        expect(dispatchActionExecutionRequest).toBeCalledWith(
          host,
          ptzAction('left', 'stop'),
        );
      });

      it('should ignore drag events after pinch until gesture ends', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        // Pinch poisons the drag.
        getHandlers().onDrag({
          pinching: true,
          last: false,
          movement: [80, 0],
        });

        // Subsequent non-pinching drag is ignored.
        getHandlers().onDrag({
          pinching: false,
          last: false,
          movement: [110, 0],
        });

        expect(dispatchActionExecutionRequest).not.toBeCalled();
      });

      it('should resume drag handling after poisoned gesture ends', () => {
        const host = createLitElement();
        const controller = new PTZDragController(host);

        controller.activateIfNecessary(document.createElement('div'));

        // Pinch poisons the drag.
        getHandlers().onDrag({
          pinching: true,
          last: false,
          movement: [80, 0],
        });

        // Gesture ends -- clears the flag.
        getHandlers().onDrag({
          pinching: false,
          last: true,
          movement: [80, 0],
        });

        expect(dispatchActionExecutionRequest).not.toBeCalled();
      });
    });

    it('should not dispatch when movement is zero', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onDrag({
        pinching: false,
        last: false,
        movement: [0, 0],
      });

      expect(dispatchActionExecutionRequest).not.toBeCalled();
    });
  });

  describe('pinch', () => {
    it('should start zoom_in on pinch out', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onPinch({ direction: [1], last: false });

      expect(dispatchActionExecutionRequest).toBeCalledWith(
        host,
        ptzAction('zoom_in', 'start'),
      );
    });

    it('should start zoom_out on pinch in', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onPinch({ direction: [-1], last: false });

      expect(dispatchActionExecutionRequest).toBeCalledWith(
        host,
        ptzAction('zoom_out', 'start'),
      );
    });

    it('should stop zoom and start new direction on pinch direction change', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onPinch({ direction: [1], last: false });
      vi.mocked(dispatchActionExecutionRequest).mockClear();

      getHandlers().onPinch({ direction: [-1], last: false });

      expect(dispatchActionExecutionRequest).toBeCalledWith(
        host,
        ptzAction('zoom_in', 'stop'),
      );
      expect(dispatchActionExecutionRequest).toBeCalledWith(
        host,
        ptzAction('zoom_out', 'start'),
      );
    });

    it('should stop zoom on pinch end', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onPinch({ direction: [1], last: false });
      vi.mocked(dispatchActionExecutionRequest).mockClear();

      getHandlers().onPinch({ direction: [1], last: true });

      expect(dispatchActionExecutionRequest).toBeCalledWith(
        host,
        ptzAction('zoom_in', 'stop'),
      );
    });

    it('should ignore zero direction', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onPinch({ direction: [0], last: false });

      expect(dispatchActionExecutionRequest).not.toBeCalled();
    });

    it('should not re-dispatch when zoom direction is unchanged', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onPinch({ direction: [1], last: false });
      vi.mocked(dispatchActionExecutionRequest).mockClear();

      getHandlers().onPinch({ direction: [1], last: false });

      expect(dispatchActionExecutionRequest).not.toBeCalled();
    });
  });

  describe('wheel', () => {
    it('should dispatch zoom_out on scroll down', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onWheel({ delta: [0, 100] });

      expect(dispatchActionExecutionRequest).toBeCalledWith(host, ptzAction('zoom_out'));
    });

    it('should dispatch zoom_in on scroll up', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onWheel({ delta: [0, -100] });

      expect(dispatchActionExecutionRequest).toBeCalledWith(host, ptzAction('zoom_in'));
    });

    it('should not dispatch on zero delta', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      controller.activateIfNecessary(document.createElement('div'));

      getHandlers().onWheel({ delta: [0, 0] });

      expect(dispatchActionExecutionRequest).not.toBeCalled();
    });
  });

  describe('cursor', () => {
    it('should set grabbing cursor on pointer down', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      const element = document.createElement('div');
      controller.activateIfNecessary(element);

      getHandlers().onPointerDown();

      expect(element.style.cursor).toBe('grabbing');
    });

    it('should restore grab cursor on pointer up', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      const element = document.createElement('div');
      controller.activateIfNecessary(element);

      getHandlers().onPointerDown();
      getHandlers().onPointerUp();

      expect(element.style.cursor).toBe('grab');
    });

    it('should restore grab cursor on pointer leave', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      const element = document.createElement('div');
      controller.activateIfNecessary(element);

      getHandlers().onPointerDown();
      getHandlers().onPointerLeave();

      expect(element.style.cursor).toBe('grab');
    });

    it('should restore grab cursor on pointer cancel', () => {
      const host = createLitElement();
      const controller = new PTZDragController(host);

      const element = document.createElement('div');
      controller.activateIfNecessary(element);

      getHandlers().onPointerDown();
      getHandlers().onPointerCancel();

      expect(element.style.cursor).toBe('grab');
    });
  });
});
