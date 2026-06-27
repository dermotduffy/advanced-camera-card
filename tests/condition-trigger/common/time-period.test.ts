import { beforeAll, describe, expect, it } from 'vitest';

import { TemplateManager } from '../../../src/card-controller/templates';
import { renderTimePeriodToSeconds } from '../../../src/condition-trigger/common/time-period';
import {
  createHASS,
  createMockTemplateRenderer,
  createStateEntity,
  stubConnectedHomeAssistant,
} from '../../test-utils';

// @vitest-environment jsdom
describe('renderTimePeriodToSeconds', () => {
  const templateManager = createMockTemplateRenderer();

  const createStateWithDelay = (delay: string) => ({
    hass: createHASS({ 'input_number.delay': createStateEntity({ state: delay }) }),
  });

  // Without `hass` the value is parsed as-is, matching HA's `cv.time_period`.
  it('should accept a number of seconds', () => {
    expect(renderTimePeriodToSeconds(templateManager, 5)).toBe(5);
    expect(renderTimePeriodToSeconds(templateManager, 0)).toBe(0);
  });

  it('should reject a negative period', () => {
    expect(renderTimePeriodToSeconds(templateManager, -1)).toBeNull();
    expect(renderTimePeriodToSeconds(templateManager, { seconds: -5 })).toBeNull();
  });

  it('should parse a bare numeric string as seconds', () => {
    expect(renderTimePeriodToSeconds(templateManager, '5')).toBe(5);
  });

  it('should read HH:MM and HH:MM:SS (two parts are hours:minutes, as in HA)', () => {
    expect(renderTimePeriodToSeconds(templateManager, '01:30')).toBe(5400);
    expect(renderTimePeriodToSeconds(templateManager, '00:05')).toBe(300);
    expect(renderTimePeriodToSeconds(templateManager, '00:00:05')).toBe(5);
    expect(renderTimePeriodToSeconds(templateManager, '1:00:00')).toBe(3600);
  });

  it('should reject unparseable, empty-part, or over-long strings', () => {
    expect(renderTimePeriodToSeconds(templateManager, 'not-a-duration')).toBeNull();
    expect(renderTimePeriodToSeconds(templateManager, '1:ab')).toBeNull();
    expect(renderTimePeriodToSeconds(templateManager, '1:2:3:4')).toBeNull();
    expect(renderTimePeriodToSeconds(templateManager, '5:')).toBeNull();
    expect(renderTimePeriodToSeconds(templateManager, '')).toBeNull();
  });

  it('should accept a {days, hours, minutes, seconds, milliseconds} dict', () => {
    expect(renderTimePeriodToSeconds(templateManager, { seconds: 5 })).toBe(5);
    expect(renderTimePeriodToSeconds(templateManager, { hours: 1, minutes: 30 })).toBe(
      5400,
    );
    expect(renderTimePeriodToSeconds(templateManager, { days: 1 })).toBe(86400);
    expect(renderTimePeriodToSeconds(templateManager, { milliseconds: 500 })).toBe(0.5);
    expect(renderTimePeriodToSeconds(templateManager, {})).toBe(0);
  });

  it('should coerce a numeric-string dict field', () => {
    expect(renderTimePeriodToSeconds(templateManager, { minutes: '2' })).toBe(120);
    expect(renderTimePeriodToSeconds(templateManager, { minutes: 'nope' })).toBeNull();
  });

  // With `hass`, templates are rendered against the current state before parsing.
  describe('with templates', () => {
    const templateManager = new TemplateManager();

    beforeAll(async () => {
      stubConnectedHomeAssistant();
      await templateManager.loadRenderer();
    });

    it('should render and parse a template string', () => {
      expect(
        renderTimePeriodToSeconds(
          templateManager,
          "{{ states('input_number.delay') }}",
          createStateWithDelay('5'),
        ),
      ).toBe(5);
    });

    it('should render and parse template fields in a dict', () => {
      expect(
        renderTimePeriodToSeconds(
          templateManager,
          { minutes: "{{ states('input_number.delay') }}" },
          createStateWithDelay('2'),
        ),
      ).toBe(120);
    });

    it('should return null when a template renders to a non-duration value', () => {
      // A string that is not a number.
      expect(
        renderTimePeriodToSeconds(
          templateManager,
          "{{ states('input_number.delay') }}",
          createStateWithDelay('nope'),
        ),
      ).toBeNull();
      // A value that is neither a number, string nor dict (here, a boolean).
      expect(
        renderTimePeriodToSeconds(
          templateManager,
          "{{ is_state('input_number.delay', 'x') }}",
          createStateWithDelay('5'),
        ),
      ).toBeNull();
    });
  });
});
