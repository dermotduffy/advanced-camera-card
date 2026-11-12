import { html, render } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  actionHandler,
  type ActionHandlerInterface,
  type AdvancedCameraCardActionHandlerOptions,
} from '../src/action-handler-directive';
import { fireHASSEvent } from '../src/ha/fire-hass-event';
import type { ActionHandlerDetail } from '../src/ha/types';
import { stopEventFromActivatingCardWideActions } from '../src/utils/action';

vi.mock('../src/ha/fire-hass-event.js');
vi.mock('../src/utils/action.js');

// @vitest-environment jsdom
const getActionHandler = (): ActionHandlerInterface => {
  const existing = document.body.querySelector('action-handler-advanced-camera-card');
  if (existing) {
    return existing as ActionHandlerInterface;
  }
  const el = document.createElement('action-handler-advanced-camera-card');
  document.body.appendChild(el);
  return el as ActionHandlerInterface;
};

const dispatchPointerClick = (element: HTMLElement): void => {
  element.dispatchEvent(new MouseEvent('click', { detail: 1 }));
};

const createBoundElement = (
  options?: AdvancedCameraCardActionHandlerOptions,
): HTMLElement => {
  const handler = getActionHandler();
  const element = document.createElement('div');
  handler.bind(element, options);
  return element;
};

describe('ActionHandler', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    // There's a single handler for the whole document. Remove it each time to
    // ensure fresh state.
    document.querySelector('action-handler-advanced-camera-card')?.remove();
  });

  describe('connectedCallback', () => {
    it('should stop hold timer on document mouse/touch events', () => {
      vi.useFakeTimers();
      const handler = getActionHandler();
      handler.connectedCallback();

      const element = createBoundElement({ hasHold: true });

      // Start a hold via mousedown.
      element.dispatchEvent(new MouseEvent('mousedown'));

      // A document-level mouseup should cancel the hold timer.
      document.dispatchEvent(new MouseEvent('mouseup'));

      // Advance past hold time -- hold should NOT have triggered.
      vi.advanceTimersByTime(500);

      dispatchPointerClick(element);

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'tap' }),
      );
    });
  });

  describe('bind', () => {
    it('should update options on re-bind without re-registering listeners', () => {
      const handler = getActionHandler();
      const element = document.createElement('div');

      handler.bind(element, { hasHold: false });
      handler.bind(element, { hasHold: true });

      expect(
        (element as unknown as { actionHandlerOptions: unknown }).actionHandlerOptions,
      ).toEqual({
        hasHold: true,
      });
    });

    it('should suppress contextmenu default behavior', () => {
      const element = createBoundElement();
      const ev = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefault = vi.spyOn(ev, 'preventDefault');
      const stopPropagation = vi.spyOn(ev, 'stopPropagation');

      element.dispatchEvent(ev);

      expect(preventDefault).toHaveBeenCalled();
      expect(stopPropagation).toHaveBeenCalled();
    });
  });

  describe('tap', () => {
    it('should fire tap on click', () => {
      const element = createBoundElement();
      dispatchPointerClick(element);

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'tap' }),
      );
    });

    it('should fire start_tap on mousedown and end_tap on click', () => {
      const element = createBoundElement();

      element.dispatchEvent(new MouseEvent('mousedown'));
      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'start_tap' }),
      );

      dispatchPointerClick(element);
      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'end_tap' }),
      );
    });

    it('should not duplicate start_tap from touchstart then mousedown', () => {
      const element = createBoundElement();

      element.dispatchEvent(new TouchEvent('touchstart'));
      element.dispatchEvent(new MouseEvent('mousedown'));

      const calls = vi.mocked(fireHASSEvent).mock.calls;
      const startTapCalls = calls.filter(
        ([, , detail]) => (detail as ActionHandlerDetail)?.action === 'start_tap',
      );
      expect(startTapCalls).toHaveLength(1);
    });

    it('should fire tap on Enter keyup', () => {
      const element = createBoundElement();

      element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'tap' }),
      );
    });

    it('should not fire tap on non-Enter keyup', () => {
      const element = createBoundElement();

      element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));

      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'tap' }),
      );
    });
  });

  describe('hold', () => {
    it('should fire hold after hold time', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      element.dispatchEvent(new MouseEvent('mousedown'));
      vi.advanceTimersByTime(500);
      dispatchPointerClick(element);

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });

    it('should fire tap when released before hold time', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      element.dispatchEvent(new MouseEvent('mousedown'));
      vi.advanceTimersByTime(100);
      dispatchPointerClick(element);

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'tap' }),
      );
      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });
  });

  describe('a key press that follows a hold', () => {
    const holdPointerOnAnotherElement = (): void => {
      const other = createBoundElement({ hasHold: true });
      other.dispatchEvent(new MouseEvent('mousedown'));
      vi.advanceTimersByTime(500);
      dispatchPointerClick(other);
      vi.mocked(fireHASSEvent).mockClear();
    };

    const expectTapNotHold = (element: HTMLElement): void => {
      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'tap' }),
      );
      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    };

    it('should fire tap for a programmatic click', () => {
      vi.useFakeTimers();
      holdPointerOnAnotherElement();

      const element = createBoundElement({ hasHold: true });
      element.click();

      expectTapNotHold(element);
    });

    it('should fire tap for an Enter keyup', () => {
      vi.useFakeTimers();
      holdPointerOnAnotherElement();

      const element = createBoundElement({ hasHold: true });
      element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));

      expectTapNotHold(element);
    });

    it('should still fire hold for a mouse press', () => {
      vi.useFakeTimers();
      holdPointerOnAnotherElement();

      const element = createBoundElement({ hasHold: true });
      element.dispatchEvent(new MouseEvent('mousedown'));
      vi.advanceTimersByTime(500);
      element.dispatchEvent(new MouseEvent('click', { detail: 1 }));

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });
  });

  describe('a pointer that moves', () => {
    const moveTo = (
      element: HTMLElement,
      type: 'mousemove' | 'touchmove',
      x: number,
      y = 0,
    ): void => {
      const ev =
        type === 'mousemove'
          ? new MouseEvent(type, { clientX: x, clientY: y })
          : new Event(type);
      if (type === 'touchmove') {
        Object.defineProperty(ev, 'touches', { value: [{ clientX: x, clientY: y }] });
      }
      element.dispatchEvent(ev);
    };

    const press = (
      element: HTMLElement,
      type: 'mousedown' | 'touchstart' = 'mousedown',
    ): void => {
      const ev =
        type === 'mousedown'
          ? new MouseEvent(type, { clientX: 0, clientY: 0 })
          : new Event(type);
      if (type === 'touchstart') {
        Object.defineProperty(ev, 'touches', { value: [{ clientX: 0, clientY: 0 }] });
      }
      element.dispatchEvent(ev);
    };

    it.each([
      { device: 'mouse', type: 'mousemove' as const },
      { device: 'touch', type: 'touchmove' as const },
    ])('should not fire hold when a $device press moves', ({ type }) => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      press(element);
      moveTo(element, type, 60);
      vi.advanceTimersByTime(500);
      dispatchPointerClick(element);

      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });

    it('should not fire hold when the pointer moves vertically', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      press(element);
      moveTo(element, 'mousemove', 0, 60);
      vi.advanceTimersByTime(500);
      dispatchPointerClick(element);

      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });

    it('should fire tap rather than hold when a moving press is released', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      press(element);
      moveTo(element, 'mousemove', 60);
      vi.advanceTimersByTime(500);
      dispatchPointerClick(element);

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'tap' }),
      );
    });

    it('should still fire hold when the pointer only slightly moves', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      press(element);
      moveTo(element, 'mousemove', 5);
      vi.advanceTimersByTime(500);
      dispatchPointerClick(element);

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });

    it('should still fire hold when a touch only slightly moves', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      press(element, 'touchstart');
      moveTo(element, 'touchmove', 5);
      vi.advanceTimersByTime(500);
      dispatchPointerClick(element);

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });

    it('should measure travel from where the press began', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      // Two moves, each within tolerance of the last but not of the origin.
      press(element);
      moveTo(element, 'mousemove', 8);
      moveTo(element, 'mousemove', 16);
      vi.advanceTimersByTime(500);
      dispatchPointerClick(element);

      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });

    it.each([
      { device: 'mouse', type: 'mousemove' as const },
      { device: 'touch', type: 'touchmove' as const },
    ])('should take back a hold a $device press had already earned', ({ type }) => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      // The hold is registered first, and only then does the pointer move.
      press(element);

      vi.advanceTimersByTime(500);

      moveTo(element, type, 60);
      dispatchPointerClick(element);

      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });

    it('should fire nothing when a touch travels far after its hold', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      press(element, 'touchstart');
      vi.advanceTimersByTime(500);
      moveTo(element, 'touchmove', 60);
      element.dispatchEvent(new Event('touchend'));

      // A browser sends no click after a touch that travelled, so the press
      // ends here as a drag rather than as a tap.
      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'tap' }),
      );
    });

    it('should ignore movement when nothing is being pressed', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      expect(() => moveTo(element, 'mousemove', 60)).not.toThrow();
    });

    it('should ignore movement that carries no position', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      press(element);
      element.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(500);
      dispatchPointerClick(element);

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });

    it('should start a fresh hold after a cancelled one', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      press(element);
      moveTo(element, 'mousemove', 60);
      vi.advanceTimersByTime(500);
      dispatchPointerClick(element);
      vi.mocked(fireHASSEvent).mockClear();

      press(element);
      vi.advanceTimersByTime(500);
      dispatchPointerClick(element);

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });
  });

  describe('double click', () => {
    it('should fire double_tap on rapid clicks', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasDoubleClick: true });

      element.dispatchEvent(new MouseEvent('click', { detail: 1 }));
      element.dispatchEvent(new MouseEvent('click', { detail: 2 }));

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'double_tap' }),
      );
    });

    it('should fire tap after double click timeout', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasDoubleClick: true });

      element.dispatchEvent(new MouseEvent('click', { detail: 1 }));
      vi.advanceTimersByTime(300);

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'tap' }),
      );
    });
  });

  describe('touch events', () => {
    it('should not fire tap on touchend without hold', () => {
      const element = createBoundElement();

      element.dispatchEvent(new TouchEvent('touchstart'));
      element.dispatchEvent(new TouchEvent('touchend'));

      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'tap' }),
      );
    });

    it('should fire hold on touchend after hold time', () => {
      vi.useFakeTimers();
      const element = createBoundElement({ hasHold: true });

      element.dispatchEvent(new TouchEvent('touchstart'));
      vi.advanceTimersByTime(500);
      element.dispatchEvent(new TouchEvent('touchend'));

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'hold' }),
      );
    });

    it('should not fire tap on touchcancel without hold', () => {
      const element = createBoundElement();

      element.dispatchEvent(new TouchEvent('touchstart'));
      element.dispatchEvent(new TouchEvent('touchcancel'));

      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'tap' }),
      );
    });
  });

  describe('propagation', () => {
    it('should stop propagation by default', () => {
      const element = createBoundElement();
      dispatchPointerClick(element);

      expect(stopEventFromActivatingCardWideActions).toHaveBeenCalled();
    });

    it('should allow propagation when configured', () => {
      const element = createBoundElement({ allowPropagation: true });
      dispatchPointerClick(element);

      expect(stopEventFromActivatingCardWideActions).not.toHaveBeenCalled();
    });
  });

  describe('mouseleave', () => {
    it('should fire end_tap on mouseleave after mousedown', () => {
      const element = createBoundElement();

      element.dispatchEvent(new MouseEvent('mousedown'));
      vi.mocked(fireHASSEvent).mockClear();

      element.dispatchEvent(new MouseEvent('mouseleave'));

      expect(fireHASSEvent).toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'end_tap' }),
      );
    });

    it('should not fire end_tap on mouseleave without prior mousedown', () => {
      const element = createBoundElement();

      element.dispatchEvent(new MouseEvent('mouseleave'));

      expect(fireHASSEvent).not.toHaveBeenCalledWith(
        element,
        'action',
        expect.objectContaining({ action: 'end_tap' }),
      );
    });
  });
});

describe('actionHandler directive', () => {
  it('should create action handler element and bind via Lit rendering', () => {
    const existing = document.body.querySelector('action-handler-advanced-camera-card');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    render(html`<div ${actionHandler()}></div>`, container);

    expect(
      document.body.querySelector('action-handler-advanced-camera-card'),
    ).not.toBeNull();
  });

  it('should reuse existing action handler element', () => {
    const container = document.createElement('div');
    render(html`<div ${actionHandler()}></div>`, container);
    render(html`<div ${actionHandler()}></div>`, container);

    const handlers = document.body.querySelectorAll(
      'action-handler-advanced-camera-card',
    );
    expect(handlers).toHaveLength(1);
  });
});
