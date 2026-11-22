import { describe, expect, it, onTestFinished } from 'vitest';

import { ZoomController } from '../../../src/components-lib/zoom/zoom-controller';
import { waitForFrame } from '../../browser/dom';

const PANZOOM_CHANGE_EVENT = 'panzoomchange';

// Waits until Panzoom has made no report for longer than the controller
// throttles its handling of them, so the controller handles the next report at
// once.
const waitForReportsToSettle = async (element: HTMLElement): Promise<void> => {
  const quietMilliseconds = 200;
  let lastReport = new Date();
  const onReport = (): void => {
    lastReport = new Date();
  };

  element.addEventListener(PANZOOM_CHANGE_EVENT, onReport);
  while (new Date().getTime() - lastReport.getTime() < quietMilliseconds) {
    await waitForFrame();
  }
  element.removeEventListener(PANZOOM_CHANGE_EVENT, onReport);
};

// The scale the browser draws the element at, part way through a transition
// included.
const getDrawnScale = (element: HTMLElement): number => {
  const transform = getComputedStyle(element).transform;
  return transform === 'none' ? 1 : new DOMMatrix(transform).a;
};

describe('ZoomController', () => {
  it('should not animate a configured zoom applied right after a wheel zoom', async () => {
    const element = document.createElement('div');
    element.style.width = '400px';
    element.style.height = '300px';
    document.body.append(element);
    onTestFinished(() => element.remove());

    const controller = new ZoomController(element);
    controller.activate();
    onTestFinished(() => controller.deactivate());
    await waitForReportsToSettle(element);

    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      ctrlKey: true,
      deltaY: -100,
      clientX: 200,
      clientY: 150,
    });

    // The configuration arrives in the same task as Panzoom's report of the
    // wheel zoom.
    const wheelScale = await new Promise<number>((resolve) => {
      const onReport = (ev: Event): void => {
        if (ev instanceof CustomEvent && ev.detail.originalEvent === wheel) {
          element.removeEventListener(PANZOOM_CHANGE_EVENT, onReport);
          controller.setSettings({ zoom: 3, pan: { x: 0, y: 0 } });
          resolve(new DOMMatrix(element.style.transform).a);
        }
      };
      element.addEventListener(PANZOOM_CHANGE_EVENT, onReport);
      element.dispatchEvent(wheel);
    });

    const drawnScales: number[] = [];
    for (let frame = 0; frame < 10; frame++) {
      await waitForFrame();
      drawnScales.push(getDrawnScale(element));
    }

    expect(wheelScale).toBeGreaterThan(1);

    // An animated zoom would be drawn at scales between the wheel zoom's and
    // the configured zoom's.
    expect(
      drawnScales.filter((scale) => scale > wheelScale + 0.01 && scale < 3 - 0.01),
    ).toEqual([]);
    expect(drawnScales.at(-1)).toBeCloseTo(3);
  });
});
