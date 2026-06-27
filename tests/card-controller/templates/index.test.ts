import { describe, expect, it, vi } from 'vitest';

import { TemplateManager } from '../../../src/card-controller/templates/index';
import { createConfig, createHASS, createStateEntity } from '../../test-utils';

describe('TemplateManager', () => {
  describe('loadRenderer', () => {
    it('should render a template raw before the engine is loaded', () => {
      const manager = new TemplateManager();
      const result = manager.renderRecursively(createHASS(), '{{ acc.camera }}', {
        conditionState: { camera: 'camera.office' },
      });
      expect(result).toBe('{{ acc.camera }}');
    });

    it('should render a template after the engine is loaded', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();

      const result = manager.renderRecursively(createHASS(), '{{ acc.camera }}', {
        conditionState: { camera: 'camera.office' },
      });
      expect(result).toBe('camera.office');
    });

    it('should be idempotent across repeat loads', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      await manager.loadRenderer();

      const result = manager.renderRecursively(createHASS(), '{{ acc.camera }}', {
        conditionState: { camera: 'camera.office' },
      });
      expect(result).toBe('camera.office');
    });

    it('should pass a non-template string through unchanged before loading', () => {
      const manager = new TemplateManager();
      expect(manager.renderRecursively(createHASS(), 'hello world')).toBe('hello world');
    });

    it('should prime the renderer on demand when a template is rendered unloaded', () => {
      const manager = new TemplateManager();
      const loadRenderer = vi.spyOn(manager, 'loadRenderer').mockResolvedValue();

      manager.renderRecursively(createHASS(), '{{ acc.camera }}');

      expect(loadRenderer).toBeCalled();
    });

    it('should swallow a load failure when priming on an unloaded render', () => {
      const manager = new TemplateManager();
      vi.spyOn(manager, 'loadRenderer').mockRejectedValue(new Error('load failed'));

      expect(() =>
        manager.renderRecursively(createHASS(), '{{ acc.camera }}'),
      ).not.toThrow();
    });
  });

  describe('isLoaded', () => {
    it('should report false before loading and true after', async () => {
      const manager = new TemplateManager();
      expect(manager.isLoaded()).toBe(false);

      await manager.loadRenderer();
      expect(manager.isLoaded()).toBe(true);
    });
  });

  describe('dataContainsTemplate', () => {
    it.each([
      ['an expression marker', 'before {{ acc.camera }} after', true],
      ['a statement marker', '{% if acc.camera %}x{% endif %}', true],
      ['a template nested in an object', { a: { b: '{{ acc.view }}' } }, true],
      ['a template nested in an array', ['plain', '{{ acc.view }}'], true],
      ['a plain string', 'no templates here', false],
      ['an unmatched marker', 'an isolated {{ with no close', false],
      ['a non-string value', { count: 42, on: true }, false],
      ['an undefined value', undefined, false],
    ])('should detect %s', (_name, data, expected) => {
      expect(TemplateManager.dataContainsTemplate(data)).toBe(expected);
    });
  });

  describe('renderRecursively', () => {
    it('should render string templates with camera context', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursively(hass, 'Camera: {{ acc.camera }}', {
        conditionState: { camera: 'camera.office' },
      });
      expect(result).toBe('Camera: camera.office');
    });

    it('should render string templates with view context', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursively(hass, 'View: {{ acc.view }}', {
        conditionState: { view: 'live' },
      });
      expect(result).toBe('View: live');
    });

    it('should render string templates with the acc context', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursively(
        hass,
        '{{ acc.camera }} - {{ acc.view }}',
        {
          conditionState: { camera: 'camera.front', view: 'clips' },
        },
      );
      expect(result).toBe('camera.front - clips');
    });

    it('should render templates in arrays', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursively(
        hass,
        ['{{ acc.camera }}', 'static', '{{ acc.view }}'],
        { conditionState: { camera: 'camera.office', view: 'live' } },
      );
      expect(result).toEqual(['camera.office', 'static', 'live']);
    });

    it('should render templates in object values', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursively(
        hass,
        { camera: '{{ acc.camera }}', view: '{{ acc.view }}', static: 'value' },
        { conditionState: { camera: 'camera.office', view: 'live' } },
      );
      expect(result).toEqual({ camera: 'camera.office', view: 'live', static: 'value' });
    });

    it('should render templates in nested objects', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursively(
        hass,
        { outer: { inner: '{{ acc.camera }}' } },
        { conditionState: { camera: 'camera.office' } },
      );
      expect(result).toEqual({ outer: { inner: 'camera.office' } });
    });

    it('should return non-string/array/object values unchanged', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      expect(manager.renderRecursively(hass, 42)).toBe(42);
      expect(manager.renderRecursively(hass, true)).toBe(true);
      expect(manager.renderRecursively(hass, null)).toBe(null);
    });

    it('should render strings without templates unchanged', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      expect(manager.renderRecursively(hass, 'hello world')).toBe('hello world');
    });

    it('should render with a top-level stock trigger context', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursively(hass, '{{ trigger.to_state.state }}', {
        triggerData: {
          platform: 'state',
          entity_id: 'binary_sensor.door',
          to_state: createStateEntity({ state: 'on' }),
        },
      });
      expect(result).toBe('on');
    });

    it('should render with a top-level card trigger context', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursively(hass, '{{ trigger.to_acc.camera }}', {
        triggerData: {
          platform: 'acc',
          type: 'camera',
          from_acc: { camera: 'camera.front' },
          to_acc: { camera: 'camera.backyard' },
        },
      });
      expect(result).toBe('camera.backyard');
    });

    it('should render with config context', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursively(hass, '{{ acc.config.view.default }}', {
        conditionState: { config: createConfig({ view: { default: 'clips' } }) },
      });
      expect(result).toBe('clips');
    });

    it('should render with mediaData context', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursively(
        hass,
        'Title: {{ acc.media.title }}, Folder: {{ acc.media.is_folder }}',
        {
          mediaData: { title: 'Test Media', is_folder: false },
        },
      );
      expect(result).toBe('Title: Test Media, Folder: false');
    });

    it('should render with combined context options', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursively(
        hass,
        '{{ acc.camera }} - {{ acc.media.title }}',
        {
          conditionState: { camera: 'camera.office' },
          mediaData: { title: 'My Video', is_folder: false },
        },
      );
      expect(result).toBe('camera.office - My Video');
    });

    it('should return undefined context when no options provided', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      // Without options, templates referencing acc should render empty.
      const result = manager.renderRecursively(hass, 'Value: {{ acc.camera }}');
      expect(result).toBe('Value:');
    });

    it('should return undefined context when options have no relevant data', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      // Empty conditionState without camera or view should not create context.
      const result = manager.renderRecursively(hass, 'Value: {{ acc.camera }}', {
        conditionState: {},
      });
      expect(result).toBe('Value:');
    });
  });

  describe('renderRecursivelyAsType', () => {
    it('should render in place while preserving the input structure', async () => {
      const manager = new TemplateManager();
      await manager.loadRenderer();
      const hass = createHASS();

      const result = manager.renderRecursivelyAsType(
        hass,
        { camera: '{{ acc.camera }}', static: 'value' },
        { conditionState: { camera: 'camera.office' } },
      );
      expect(result).toEqual({ camera: 'camera.office', static: 'value' });
    });
  });
});
