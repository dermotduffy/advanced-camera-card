import { afterEach, describe, expect, it, Mock, vi } from 'vitest';

import { ScreenTrigger } from '../../../../src/condition-trigger/triggers/triggers/screen';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';

// @vitest-environment jsdom
describe('ScreenTrigger', () => {
  let matches = false;
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  const mockMatchMedia = (): void => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          get matches(): boolean {
            return matches;
          },
          addEventListener,
          removeEventListener,
        }) as unknown as MediaQueryList,
    );
  };

  const subscribe = (
    trigger: TriggerOfType<'screen'>,
  ): { screenTrigger: ScreenTrigger; callback: Mock } => {
    const callback = vi.fn();
    const screenTrigger = new ScreenTrigger(trigger);
    screenTrigger.subscribe(callback);
    return { screenTrigger, callback };
  };

  const fireMediaQueryChange = (): void => addEventListener.mock.calls[0][1]();

  afterEach(() => {
    vi.restoreAllMocks();
    matches = false;
    addEventListener.mockClear();
    removeEventListener.mockClear();
  });

  it('should trigger on the rising edge of the media query match', () => {
    mockMatchMedia();
    const { callback } = subscribe({
      trigger: 'screen',
      media_query: '(orientation: landscape)',
    });

    matches = true;
    fireMediaQueryChange();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ platform: 'acc', type: 'screen' });
  });

  it('should not trigger again while the query stays matching', () => {
    mockMatchMedia();
    const { callback } = subscribe({
      trigger: 'screen',
      media_query: '(orientation: landscape)',
    });

    matches = true;
    fireMediaQueryChange();
    fireMediaQueryChange();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not trigger on the falling edge of the match', () => {
    mockMatchMedia();
    const { callback } = subscribe({
      trigger: 'screen',
      media_query: '(orientation: landscape)',
    });

    matches = true;
    fireMediaQueryChange();
    matches = false;
    fireMediaQueryChange();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not trigger when already matching at subscribe', () => {
    matches = true;
    mockMatchMedia();
    const { callback } = subscribe({
      trigger: 'screen',
      media_query: '(orientation: landscape)',
    });

    fireMediaQueryChange();
    expect(callback).not.toHaveBeenCalled();
  });

  it('should stop listening after destroy', () => {
    mockMatchMedia();
    const { screenTrigger } = subscribe({
      trigger: 'screen',
      media_query: '(orientation: landscape)',
    });

    screenTrigger.destroy();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.anything());
  });

  it('should never trigger without a media query', () => {
    mockMatchMedia();
    const { callback } = subscribe({ trigger: 'screen' });

    expect(addEventListener).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });
});
