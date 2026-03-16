import { html, render } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionHandlerInterface, actionHandler } from '../src/action-handler-directive';
import { fireHASSEvent } from '../src/ha/fire-hass-event';
import { ActionHandlerDetail } from '../src/ha/types';
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

const createBoundElement = (options?: Record<string, unknown>): HTMLElement => {
  const handler = getActionHandler();
  const element = document.createElement('div');
  handler.bind(element, options);
  return element;
};

describe('ActionHandler', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
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

      // Advance past hold time — hold should NOT have triggered.
      vi.advanceTimersByTime(500);

      element.dispatchEvent(new MouseEvent('click'));

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
      element.dispatchEvent(new MouseEvent('click'));

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

      element.dispatchEvent(new MouseEvent('click'));
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
      element.dispatchEvent(new MouseEvent('click'));

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
      element.dispatchEvent(new MouseEvent('click'));

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
      element.dispatchEvent(new MouseEvent('click'));

      expect(stopEventFromActivatingCardWideActions).toHaveBeenCalled();
    });

    it('should allow propagation when configured', () => {
      const element = createBoundElement({ allowPropagation: true });
      element.dispatchEvent(new MouseEvent('click'));

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
