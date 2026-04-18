import { Task } from '@lit-labs/task';
import { html, render, TemplateResult } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { renderProgressIndicator } from '../../src/components/progress-indicator';
import { renderTask } from '../../src/utils/task';

vi.mock('../../src/components/progress-indicator');

const getRenderedContent = (template: TemplateResult): string => {
  const container = document.createElement('div');
  render(template, container);
  return container.textContent || '';
};

// @vitest-environment jsdom
describe('task utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render initial state', () => {
    const task = mock<Task<unknown[], string>>();
    task.render.mockImplementation((renderers) => renderers.initial?.());
    vi.mocked(renderProgressIndicator).mockReturnValue(html`progress`);

    const result = renderTask(task, (r) => html`${r}`);
    expect(getRenderedContent(result)).toContain('progress');
  });

  it('should render pending state', () => {
    const task = mock<Task<unknown[], string>>();
    task.render.mockImplementation((renderers) => renderers.pending?.());
    vi.mocked(renderProgressIndicator).mockReturnValue(html`progress`);

    const result = renderTask(task, (r) => html`${r}`);
    expect(getRenderedContent(result)).toContain('progress');
  });

  it('should render error state', () => {
    const task = mock<Task<unknown[], string>>();
    task.render.mockImplementation((renderers) =>
      renderers.error?.(new Error('test error')),
    );
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorFunc = vi.fn().mockReturnValue(html`error`);

    const result = renderTask(task, (r) => html`${r}`, { errorFunc });

    expect(errorFunc).toHaveBeenCalledWith(new Error('test error'));
    expect(consoleSpy).toHaveBeenCalled();
    expect(getRenderedContent(result)).toContain('error');
  });

  it('should render complete state', () => {
    const task = mock<Task<unknown[], string>>();
    task.render.mockImplementation((renderers) => renderers.complete?.('result'));

    const result = renderTask(task, (r) => html`complete: ${r}`);
    expect(getRenderedContent(result)).toContain('complete: result');
  });

  it('should use custom inProgressFunc', () => {
    const task = mock<Task<unknown[], string>>();
    task.render.mockImplementation((renderers) => renderers.initial?.());
    const inProgressFunc = () => html`custom progress`;

    const result = renderTask(task, (r) => html`${r}`, { inProgressFunc });
    expect(getRenderedContent(result)).toContain('custom progress');
  });

  it('should use cardWideConfig', () => {
    const task = mock<Task<unknown[], string>>();
    task.render.mockImplementation((renderers) => renderers.initial?.());
    const cardWideConfig = {};

    vi.mocked(renderProgressIndicator).mockReturnValue(html`progress`);

    renderTask(task, (r) => html`${r}`, { cardWideConfig });

    expect(renderProgressIndicator).toHaveBeenCalledWith({
      cardWideConfig,
    });
  });
});
