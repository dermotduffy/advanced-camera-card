import { describe, expect, it, vi } from 'vitest';
import { getEntityStateTranslation } from '../../src/ha/entity-state-translation';
import { createHASS, createRegistryEntity, createStateEntity } from '../test-utils';

describe('getEntityStateTranslation', () => {
  it('returns null if state is missing', () => {
    expect(getEntityStateTranslation(createHASS(), 'light.office')).toBeNull();
  });

  it('returns translation_key translation if available', () => {
    const entity = createRegistryEntity({
      entity_id: 'light.office',
      translation_key: 'translation_key',
    });
    const hass = createHASS({
      'light.office': createStateEntity({
        state: 'on',
        attributes: {},
      }),
    });
    vi.mocked(hass.localize).mockReturnValue('Translated State');

    expect(getEntityStateTranslation(hass, 'light.office', { entity })).toBe(
      'Translated State',
    );
  });

  it('returns device_class translation if translation_key not available', () => {
    const entity = createRegistryEntity({
      entity_id: 'light.office',
    });
    const hass = createHASS({
      'light.office': createStateEntity({
        state: 'on',
        attributes: {
          device_class: 'light',
        },
      }),
    });
    vi.mocked(hass.localize).mockReturnValue('Translated State');

    expect(getEntityStateTranslation(hass, 'light.office', { entity })).toBe(
      'Translated State',
    );
  });

  it('returns default translation if translation_key not available', () => {
    const entity = createRegistryEntity({
      entity_id: 'light.office',
    });
    const hass = createHASS({
      'light.office': createStateEntity({
        state: 'on',
      }),
    });
    vi.mocked(hass.localize).mockReturnValue('Translated State');

    expect(getEntityStateTranslation(hass, 'light.office', { entity })).toBe(
      'Translated State',
    );
  });

  it('returns raw state if no translation found', () => {
    const entity = createRegistryEntity({
      entity_id: 'light.office',
    });
    const hass = createHASS({
      'light.office': createStateEntity({
        state: 'on',
      }),
    });
    vi.mocked(hass.localize).mockReturnValue('');

    expect(getEntityStateTranslation(hass, 'light.office', { entity })).toBe('on');
  });

  it('uses passed in state', () => {
    const entity = createRegistryEntity({
      entity_id: 'light.office',
    });
    const hass = createHASS();
    vi.mocked(hass.localize).mockReturnValue('');

    expect(
      getEntityStateTranslation(hass, 'light.office', { entity, state: 'off' }),
    ).toBe('off');
  });
});
