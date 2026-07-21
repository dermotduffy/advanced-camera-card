import { describe, expect, it } from 'vitest';

import { IconController } from '../../src/components-lib/icon-controller';
import { createHASS, createStateEntity } from '../test-utils';

describe('IconController', () => {
  describe('should get icon name', () => {
    it.each(['frigate', 'iris', 'motioneye', 'reolink', 'tplink'])(
      'should prefix the bare legacy name %s',
      (name) => {
        expect(new IconController().getIconName({ icon: name })).toBe(
          `advanced-camera-card:${name}`,
        );
      },
    );

    it('should leave an iconset-prefixed name untouched', () => {
      expect(
        new IconController().getIconName({ icon: 'advanced-camera-card:frigate' }),
      ).toBe('advanced-camera-card:frigate');
    });

    it('should leave an mdi name untouched', () => {
      expect(new IconController().getIconName({ icon: 'mdi:car' })).toBe('mdi:car');
    });

    it('should return null for an undefined icon', () => {
      expect(new IconController().getIconName()).toBeNull();
    });
  });

  describe('should create state object for state badge', () => {
    it('should return null for non-existent entity', () => {
      expect(
        new IconController().createStateObjectForStateBadge(
          createHASS(),
          'sensor.DOES_NOT_EXIST',
        ),
      ).toBeNull();
    });

    it('should return modified state object for existing entity', () => {
      expect(
        new IconController().createStateObjectForStateBadge(
          createHASS({
            'sensor.existing': createStateEntity({
              entity_id: 'sensor.existing',
              attributes: {
                friendly_name: 'Existing',
                icon: 'mdi:car',
                entity_picture: 'http://example.com/image.jpg',
                entity_picture_local: 'local.jpg',
              },
            }),
          }),
          'sensor.existing',
        ),
      ).toEqual(
        expect.objectContaining({
          entity_id: 'sensor.existing',
          attributes: expect.objectContaining({
            friendly_name: 'Existing',
            icon: 'mdi:car',
            entity_picture: undefined,
            entity_picture_local: undefined,
          }),
        }),
      );
    });
  });
});
