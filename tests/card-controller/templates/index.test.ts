import { describe, expect, it } from 'vitest';
import { TemplateRenderer } from '../../../src/card-controller/templates/index';
import { createHASS, createStateEntity } from '../../test-utils';

describe('TemplateRenderer', () => {
  describe('renderRecursively', () => {
    it('should render string templates with camera context', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      const result = renderer.renderRecursively(hass, 'Camera: {{ acc.camera }}', {
        conditionState: { camera: 'camera.office' },
      });
      expect(result).toBe('Camera: camera.office');
    });

    it('should render string templates with view context', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      const result = renderer.renderRecursively(hass, 'View: {{ acc.view }}', {
        conditionState: { view: 'live' },
      });
      expect(result).toBe('View: live');
    });

    it('should render string templates with full advanced_camera_card context', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      const result = renderer.renderRecursively(
        hass,
        '{{ advanced_camera_card.camera }} - {{ advanced_camera_card.view }}',
        {
          conditionState: { camera: 'camera.front', view: 'clips' },
        },
      );
      expect(result).toBe('camera.front - clips');
    });

    it('should render templates in arrays', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      const result = renderer.renderRecursively(
        hass,
        ['{{ acc.camera }}', 'static', '{{ acc.view }}'],
        { conditionState: { camera: 'camera.office', view: 'live' } },
      );
      expect(result).toEqual(['camera.office', 'static', 'live']);
    });

    it('should render templates in object values', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      const result = renderer.renderRecursively(
        hass,
        { camera: '{{ acc.camera }}', view: '{{ acc.view }}', static: 'value' },
        { conditionState: { camera: 'camera.office', view: 'live' } },
      );
      expect(result).toEqual({ camera: 'camera.office', view: 'live', static: 'value' });
    });

    it('should render templates in nested objects', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      const result = renderer.renderRecursively(
        hass,
        { outer: { inner: '{{ acc.camera }}' } },
        { conditionState: { camera: 'camera.office' } },
      );
      expect(result).toEqual({ outer: { inner: 'camera.office' } });
    });

    it('should return non-string/array/object values unchanged', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      expect(renderer.renderRecursively(hass, 42)).toBe(42);
      expect(renderer.renderRecursively(hass, true)).toBe(true);
      expect(renderer.renderRecursively(hass, null)).toBe(null);
    });

    it('should render strings without templates unchanged', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      expect(renderer.renderRecursively(hass, 'hello world')).toBe('hello world');
    });

    it('should render with a top-level stock trigger context', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      const result = renderer.renderRecursively(hass, '{{ trigger.to_state.state }}', {
        triggerData: {
          platform: 'state',
          entity_id: 'binary_sensor.door',
          to_state: createStateEntity({ state: 'on' }),
        },
      });
      expect(result).toBe('on');
    });

    it('should render with a top-level card trigger context', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      const result = renderer.renderRecursively(hass, '{{ trigger.to_acc.camera }}', {
        triggerData: {
          platform: 'acc',
          type: 'camera',
          from_acc: { camera: 'camera.front' },
          to_acc: { camera: 'camera.backyard' },
        },
      });
      expect(result).toBe('camera.backyard');
    });

    it('should render with mediaData context', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      const result = renderer.renderRecursively(
        hass,
        'Title: {{ acc.media.title }}, Folder: {{ acc.media.is_folder }}',
        {
          mediaData: { title: 'Test Media', is_folder: false },
        },
      );
      expect(result).toBe('Title: Test Media, Folder: false');
    });

    it('should render with combined context options', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      const result = renderer.renderRecursively(
        hass,
        '{{ acc.camera }} - {{ acc.media.title }}',
        {
          conditionState: { camera: 'camera.office' },
          mediaData: { title: 'My Video', is_folder: false },
        },
      );
      expect(result).toBe('camera.office - My Video');
    });

    it('should return undefined context when no options provided', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      // Without options, templates referencing acc should render empty.
      const result = renderer.renderRecursively(hass, 'Value: {{ acc.camera }}');
      expect(result).toBe('Value:');
    });

    it('should return undefined context when options have no relevant data', () => {
      const renderer = new TemplateRenderer();
      const hass = createHASS();

      // Empty conditionState without camera or view should not create context.
      const result = renderer.renderRecursively(hass, 'Value: {{ acc.camera }}', {
        conditionState: {},
      });
      expect(result).toBe('Value:');
    });
  });
});
