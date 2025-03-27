import { describe, expect, it } from 'vitest';
import { Capabilities } from '../../src/camera-manager/capabilities';
import {
  CapabilityKey,
  PTZCapabilities,
  PTZMovementType,
  capabilityKeys,
} from '../../src/types';

describe('Capabilities', () => {
  it('default capabilities', () => {
    const capabilities = new Capabilities({});
    for (const key of capabilityKeys) {
      expect(capabilities.has(key)).toBeFalsy();
    }
  });

  describe('simple presence checks', () => {
    it.each([
      'clips',
      'favorite-events',
      'favorite-recordings',
      'live',
      'menu',
      'recordings',
      'seek',
      'snapshots',
      'substream',
    ] as const)('%s', (capability: CapabilityKey) => {
      const capabilities = new Capabilities({
        [capability]: true,
      });
      expect(capabilities.has(capability)).toBeTruthy();
    });
  });

  describe('complex matches', () => {
    it('string matcher', () => {
      const capabilities = new Capabilities({
        live: true,
      });
      expect(capabilities.matches('live')).toBeTruthy();
      expect(capabilities.matches('clips')).toBeFalsy();
    });

    it('allCapabilities matcher', () => {
      const capabilities = new Capabilities({
        live: true,
        clips: true,
      });
      expect(capabilities.matches({ allCapabilities: ['live', 'clips'] })).toBeTruthy();
      expect(
        capabilities.matches({ allCapabilities: ['live', 'snapshots'] }),
      ).toBeFalsy();
    });

    it('anyCapabilities matcher', () => {
      const capabilities = new Capabilities({
        live: true,
        clips: true,
      });
      expect(capabilities.matches({ anyCapabilities: ['live', 'clips'] })).toBeTruthy();
      expect(
        capabilities.matches({ anyCapabilities: ['live', 'snapshots'] }),
      ).toBeTruthy();
      expect(
        capabilities.matches({ anyCapabilities: ['snapshots', 'menu'] }),
      ).toBeFalsy();
    });
  });

  describe('getPTZCapabilities', () => {
    it('when unset', () => {
      const capabilities = new Capabilities({});
      expect(capabilities.getPTZCapabilities()).toBeNull();
      expect(capabilities.hasPTZCapability()).toBeFalsy();
    });

    it('when set', () => {
      const ptz: PTZCapabilities = {
        left: [PTZMovementType.Continuous],
        presets: ['1', '2'],
      };
      const capabilities = new Capabilities({
        ptz: ptz,
      });
      expect(capabilities.getPTZCapabilities()).toBe(ptz);
      expect(capabilities.hasPTZCapability()).toBeTruthy();
    });
  });

  describe('disable capabilities', () => {
    it('disable', () => {
      const capabilities = new Capabilities(
        {
          live: true,
          clips: true,
          snapshots: true,
        },
        {
          disable: ['live', 'clips'],
        },
      );
      expect(capabilities.has('live')).toBeFalsy();
      expect(capabilities.has('clips')).toBeFalsy();
      expect(capabilities.has('snapshots')).toBeTruthy();
    });

    it('disableExcept', () => {
      const capabilities = new Capabilities(
        {
          live: true,
          clips: true,
          snapshots: true,
        },
        {
          disableExcept: ['live', 'clips'],
        },
      );
      expect(capabilities.has('live')).toBeTruthy();
      expect(capabilities.has('clips')).toBeTruthy();
      expect(capabilities.has('snapshots')).toBeFalsy();
    });
  });
});
