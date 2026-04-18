import { describe, expect, it } from 'vitest';
import { IconController } from '../../src/components-lib/icon-controller';
import { createHASS, createStateEntity } from '../test-utils';

describe('IconController', () => {
  describe('should get custom icon', () => {
    it('should return frigate SVG for frigate icon', () => {
      expect(new IconController().getCustomIcon({ icon: 'frigate' })).toMatch(
        /frigate.svg$/,
      );
    });

    it('should return motioneye SVG for motioneye icon', () => {
      expect(new IconController().getCustomIcon({ icon: 'motioneye' })).toMatch(
        /motioneye.svg$/,
      );
    });

    it('should return reolink SVG for reolink icon', () => {
      expect(new IconController().getCustomIcon({ icon: 'reolink' })).toMatch(
        /reolink.svg$/,
      );
    });

    it('should return tplink SVG for tplink icon', () => {
      expect(new IconController().getCustomIcon({ icon: 'tplink' })).toMatch(
        /tplink.svg$/,
      );
    });

    it('should return iris SVG for iris icon', () => {
      expect(new IconController().getCustomIcon({ icon: 'iris' })).toMatch(/iris.svg$/);
    });

    it('should return null for mdi icon', () => {
      expect(new IconController().getCustomIcon({ icon: 'mdi:car' })).toBeNull();
    });

    it('should return null for undefined icon', () => {
      expect(new IconController().getCustomIcon()).toBeNull();
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
