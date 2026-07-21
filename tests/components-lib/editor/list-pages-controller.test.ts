import { describe, expect, it } from 'vitest';

import { ListPagesController } from '../../../src/components-lib/editor/list-pages-controller';
import { createLitElement } from '../../test-utils';

const createController = () => {
  const host = createLitElement();
  return { host, controller: new ListPagesController(host) };
};

// @vitest-environment jsdom
describe('ListPagesController', () => {
  it('should register with the host', () => {
    const { host, controller } = createController();
    expect(host.addController).toHaveBeenCalledWith(controller);
    controller.hostConnected();
  });

  it('should start on the list itself', () => {
    const { controller } = createController();
    expect(controller.getPath()).toEqual([]);
  });

  it('should open an item and request an update', () => {
    const { host, controller } = createController();

    controller.open('cameras', 2);

    expect(controller.getPath()).toEqual([{ list: 'cameras', index: 2 }]);
    expect(host.requestUpdate).toHaveBeenCalledTimes(1);
  });

  it('should open an item within an open item', () => {
    const { controller } = createController();
    controller.open('cameras', 2);

    controller.open('events', 0);

    expect(controller.getPath()).toEqual([
      { list: 'cameras', index: 2 },
      { list: 'events', index: 0 },
    ]);
  });

  it('should go back to the item above', () => {
    const { controller } = createController();
    controller.open('cameras', 2);
    controller.open('events', 0);

    controller.back();

    expect(controller.getPath()).toEqual([{ list: 'cameras', index: 2 }]);
  });

  it('should go back to the list itself', () => {
    const { host, controller } = createController();
    controller.open('cameras', 2);

    controller.back();

    expect(controller.getPath()).toEqual([]);
    expect(host.requestUpdate).toHaveBeenCalledTimes(2);
  });

  it('should ignore going back from the list itself', () => {
    const { host, controller } = createController();

    controller.back();

    expect(controller.getPath()).toEqual([]);
    expect(host.requestUpdate).not.toHaveBeenCalled();
  });
});
