import { describe, expect, it, vi } from 'vitest';
import { ExpandManager } from '../../src/card-controller/expand-manager';
import { createCardAPI, createLitElement } from '../test-utils';

// @vitest-environment jsdom
describe('ExpandManager', () => {
  it('should construct', () => {
    const api = createCardAPI();
    const manager = new ExpandManager(api);
    expect(manager.isExpanded()).toBeFalsy();
  });

  it('should initialize', () => {
    const api = createCardAPI();
    const manager = new ExpandManager(api);

    manager.initialize();
    expect(api.getConditionStateManager().setState).toBeCalledWith({ expand: false });
  });

  it('should set expanded', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    vi.mocked(api.getFullscreenManager().isInFullscreen).mockReturnValue(true);
    const manager = new ExpandManager(api);

    manager.setExpanded(true);

    expect(manager.isExpanded()).toBeTruthy();
    expect(api.getFullscreenManager().setFullscreen).toBeCalledWith(false);
    expect(api.getConditionStateManager().setState).toBeCalledWith({ expand: true });
    expect(api.getCardElementManager().update).toBeCalled();
    expect(element.hasAttribute('expanded')).toBeTruthy();
  });

  it('should not exit fullscreen when not in fullscreen', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    vi.mocked(api.getFullscreenManager().isInFullscreen).mockReturnValue(false);
    const manager = new ExpandManager(api);

    manager.setExpanded(true);

    expect(api.getFullscreenManager().setFullscreen).not.toBeCalled();
  });

  it('should toggle expanded', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    vi.mocked(api.getFullscreenManager().isInFullscreen).mockReturnValue(false);
    const manager = new ExpandManager(api);

    manager.toggleExpanded();
    expect(manager.isExpanded()).toBeTruthy();
    expect(element.hasAttribute('expanded')).toBeTruthy();

    manager.toggleExpanded();
    expect(manager.isExpanded()).toBeFalsy();
    expect(element.hasAttribute('expanded')).toBeFalsy();
  });

  it('should set expanded attribute on card element when expanded', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    vi.mocked(api.getFullscreenManager().isInFullscreen).mockReturnValue(false);
    const manager = new ExpandManager(api);

    expect(element.hasAttribute('expanded')).toBeFalsy();

    manager.setExpanded(true);

    expect(element.hasAttribute('expanded')).toBeTruthy();
  });

  it('should remove expanded attribute on card element when collapsed', () => {
    const api = createCardAPI();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    vi.mocked(api.getFullscreenManager().isInFullscreen).mockReturnValue(false);
    const manager = new ExpandManager(api);

    manager.setExpanded(true);
    expect(element.hasAttribute('expanded')).toBeTruthy();

    manager.setExpanded(false);
    expect(element.hasAttribute('expanded')).toBeFalsy();
  });
});
