import { renderTemplate } from 'ha-nunjucks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplateRenderer } from '../../src/card-controller/templates';
import { ConditionsTriggerData, ConditionState } from '../../src/conditions/types';
import { createHASS } from '../test-utils';

// ha-nunjucks attempts to make websocket calls initially so mock it out.
vi.mock('ha-nunjucks');

describe('TemplateRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render data', () => {
    const data = {
      camera: '{{ acc.camera }}',
      array: ['{{ acc.camera }}', '{{ acc.view }}'],
      nested: {
        camera: '{{ acc.camera }}',
      },
      number: 42,
    };

    vi.mocked(renderTemplate)
      .mockReturnValueOnce('one')
      .mockReturnValueOnce('two')
      .mockReturnValueOnce('three')
      .mockReturnValueOnce('four');

    const renderer = new TemplateRenderer();
    const hass = createHASS();

    expect(renderer.renderRecursively(hass, data)).toEqual({
      camera: 'one',
      array: ['two', 'three'],
      nested: {
        camera: 'four',
      },
      number: 42,
    });
  });

  it('should include triggers', () => {
    const conditionState: ConditionState = {
      camera: 'camera',
      view: 'view',
    };
    const triggerData: ConditionsTriggerData = {
      camera: {
        to: 'camera',
        from: 'previous-camera',
      },
    };

    const renderer = new TemplateRenderer();
    const hass = createHASS();

    renderer.renderRecursively(
      hass,
      {
        key: 'value',
      },
      {
        conditionState,
        triggerData,
      },
    );

    expect(renderTemplate).toHaveBeenCalledWith(hass, 'value', {
      acc: {
        camera: 'camera',
        view: 'view',
        trigger: {
          camera: {
            to: 'camera',
            from: 'previous-camera',
          },
        },
      },
      advanced_camera_card: {
        camera: 'camera',
        view: 'view',
        trigger: {
          camera: {
            to: 'camera',
            from: 'previous-camera',
          },
        },
      },
    });
  });
});
