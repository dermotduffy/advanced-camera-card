import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { TemplateRenderer } from '../../../src/card-controller/templates/index';
import {
  getTemplateRendererViaEvent,
  type TemplateRendererGetEvent,
} from '../../../src/card-controller/templates/renderer-via-event';

// @vitest-environment jsdom
describe('getTemplateRendererViaEvent', () => {
  it('should dispatch event and retrieve template renderer', () => {
    const element = document.createElement('div');
    const templateRenderer = mock<TemplateRenderer>();

    const handler = vi.fn().mockImplementation((ev: TemplateRendererGetEvent) => {
      ev.templateRenderer = templateRenderer;
    });
    element.addEventListener('advanced-camera-card:template-renderer:get', handler);

    expect(getTemplateRendererViaEvent(element)).toBe(templateRenderer);
  });

  it('should return null when no template renderer is provided', () => {
    const element = document.createElement('div');

    const handler = vi.fn();
    element.addEventListener('advanced-camera-card:template-renderer:get', handler);

    expect(getTemplateRendererViaEvent(element)).toBeNull();
  });
});
