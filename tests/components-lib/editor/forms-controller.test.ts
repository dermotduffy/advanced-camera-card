import { html } from 'lit';
import { describe, expect, it, vi } from 'vitest';

import { FormsController } from '../../../src/components-lib/editor/forms-controller';

const OPTIONS = { cameras: [], folders: [] };
const INPUT = { config: {}, defaults: {}, options: OPTIONS };
const MENU = { kind: 'section' as const, name: 'menu' };

const createController = () => {
  const onChanges = vi.fn();
  return {
    onChanges,
    controller: new FormsController(onChanges, () => html`doc`),
  };
};

describe('FormsController', () => {
  it('should have no contexts before it is given a request', () => {
    const { controller } = createController();
    expect(controller.getContexts()).toEqual([]);
  });

  it('should build the forms of the requested section', () => {
    const { controller } = createController();

    controller.setInput(MENU, INPUT);

    const contexts = controller.getContexts();
    expect(contexts.length).toBeGreaterThan(0);
    expect(contexts[0].form.basePath).toEqual(['menu']);
  });

  it('should build the forms again for a different request', () => {
    const { controller } = createController();
    controller.setInput(MENU, INPUT);

    controller.setInput({ kind: 'section', name: 'timeline' }, INPUT);

    expect(controller.getContexts()[0].form.basePath).toEqual(['timeline']);
  });

  it('should keep the same forms when only the configuration changes', () => {
    const { controller } = createController();
    controller.setInput(MENU, INPUT);
    const before = controller.getContexts()[0].form;

    controller.setInput(MENU, { ...INPUT, config: { menu: { style: 'outside' } } });

    expect(controller.getContexts()[0].form).toBe(before);
  });

  it('should keep the same contexts when nothing changed', () => {
    const { controller } = createController();
    controller.setInput(MENU, INPUT);
    const before = controller.getContexts();

    controller.setInput(MENU, { ...INPUT });

    expect(controller.getContexts()).toBe(before);
  });

  it('should build the forms again when the values its selectors offer change', () => {
    const { controller } = createController();
    const request = { kind: 'camera' as const, index: 0 };
    controller.setInput(request, INPUT);
    const before = controller.getContexts()[0].form;

    // A second camera: the first camera's dependency dropdown, which lists the
    // cameras other than itself, now has something to offer.
    controller.setInput(request, {
      ...INPUT,
      options: {
        ...OPTIONS,
        cameras: [
          { value: 'camera.one', label: 'One' },
          { value: 'camera.other', label: 'Other' },
        ],
      },
    });

    expect(controller.getContexts()[0].form).not.toBe(before);
  });

  it('should keep the forms it has when a rebuild produces the same ones', () => {
    const { controller } = createController();
    const request = { kind: 'camera' as const, index: 0 };
    const cameras = [
      { value: 'camera.one', label: 'One' },
      { value: 'camera.two', label: 'Two' },
    ];
    controller.setInput(request, { ...INPUT, options: { ...OPTIONS, cameras } });
    const before = controller.getContexts()[0];

    // Renaming the camera whose form this is: its own form leaves it out, so
    // nothing it shows has changed.
    controller.setInput(request, {
      ...INPUT,
      options: {
        ...OPTIONS,
        cameras: [{ ...cameras[0], label: 'Renamed' }, cameras[1]],
      },
    });

    expect(controller.getContexts()[0]).toBe(before);
  });

  it('should show the configured value of a field', () => {
    const { controller } = createController();

    controller.setInput(MENU, { ...INPUT, config: { menu: { style: 'outside' } } });

    expect(controller.getContexts()[0].displayedData['style']).toBe('outside');
  });

  it('should name a field', () => {
    const { controller } = createController();
    controller.setInput(MENU, INPUT);

    const label = controller.getContexts()[0].computeLabel({
      name: 'style',
      selector: { text: {} },
    });

    expect(label).not.toBe('');
  });

  it('should link a documented field to its documentation', () => {
    const { controller } = createController();
    controller.setInput(MENU, INPUT);

    expect(
      controller.getContexts()[0].computeHelper({
        name: 'buttons',
        type: 'expandable',
        title: '',
        schema: [],
      }),
    ).not.toBeNull();
  });

  it('should not link a field that has no documentation', () => {
    const { controller } = createController();
    controller.setInput(MENU, INPUT);

    expect(
      controller.getContexts()[0].computeHelper({
        name: 'style',
        selector: { text: {} },
      }),
    ).toBeNull();
  });

  it('should report an edit as changes on absolute paths', () => {
    const { controller, onChanges } = createController();
    controller.setInput(MENU, INPUT);

    controller
      .getContexts()[0]
      .valueChanged(
        new CustomEvent('value-changed', { detail: { value: { style: 'outside' } } }),
      );

    expect(onChanges).toHaveBeenCalledWith([
      { path: ['menu', 'style'], type: 'set', value: 'outside' },
    ]);
  });

  it('should ignore an edit that changes nothing', () => {
    const { controller, onChanges } = createController();
    controller.setInput(MENU, { ...INPUT, config: { menu: { style: 'outside' } } });

    controller
      .getContexts()[0]
      .valueChanged(
        new CustomEvent('value-changed', { detail: { value: { style: 'outside' } } }),
      );

    expect(onChanges).not.toHaveBeenCalled();
  });

  it('should ignore an edit reported by a form it no longer has', () => {
    const { controller, onChanges } = createController();
    controller.setInput(MENU, INPUT);
    const contexts = controller.getContexts();
    expect(contexts.length).toBeGreaterThan(1);
    const last = contexts[contexts.length - 1];

    // The dimensions section has a single form, so the last of the menu
    // section's forms no longer exists once it is asked for.
    controller.setInput({ kind: 'section', name: 'dimensions' }, INPUT);
    last.valueChanged(
      new CustomEvent('value-changed', { detail: { value: { style: 'outside' } } }),
    );

    expect(onChanges).not.toHaveBeenCalled();
  });
});
