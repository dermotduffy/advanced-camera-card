import { add } from 'date-fns';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InteractionManager } from '../../src/card-controller/interaction-manager';
import { createCardAPI, createConfig, createLitElement } from '../test-utils';

vi.mock('lodash-es', () => ({
  throttle: vi.fn((fn) => fn),
}));

// @vitest-environment jsdom
describe('InteractionManager', () => {
  const start = new Date('2023-09-24T20:20:00');

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);

    const manager = new InteractionManager(api);

    manager.initialize();
    expect(api.getConditionStateManager().setState).toBeCalledWith({
      interaction: false,
    });
    expect(element.getAttribute('interaction')).toBeNull();
  });

  it('should still report interaction without an interaction timeout', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          interaction_seconds: 0,
        },
      }),
    );
    const manager = new InteractionManager(api);

    manager.reportInteraction();

    expect(element.getAttribute('interaction')).not.toBeNull();
    expect(manager.hasInteraction()).toBeTruthy();
  });

  it('should set condition state', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);

    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          interaction_seconds: 10,
        },
      }),
    );
    const manager = new InteractionManager(api);
    vi.useFakeTimers();
    vi.setSystemTime(start);

    expect(api.getConditionStateManager().setState).not.toBeCalled();

    manager.reportInteraction();

    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        interaction: true,
      }),
    );
    expect(manager.hasInteraction()).toBeTruthy();
    expect(element.getAttribute('interaction')).not.toBeNull();

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        interaction: false,
      }),
    );
    expect(manager.hasInteraction()).toBeFalsy();
    expect(element.getAttribute('interaction')).toBeNull();
  });
});
