import { describe, expect, it } from 'vitest';

import {
  isAndroidCompanionApp,
  isCompanionApp,
  isIOSCompanionApp,
} from '../../src/utils/companion';

describe('isCompanionApp', () => {
  it('should return true for userAgent starting with "Home Assistant/"', () => {
    expect(isCompanionApp('Home Assistant/1.0')).toBe(true);
  });

  it('should return true for userAgent starting with "HomeAssistant/"', () => {
    expect(isCompanionApp('HomeAssistant/1.0')).toBe(true);
  });

  it('should return false for userAgent not starting with "Home Assistant/" or "HomeAssistant/"', () => {
    expect(isCompanionApp('Mozilla/5.0')).toBe(false);
  });

  it('should return false for an empty userAgent', () => {
    expect(isCompanionApp('')).toBe(false);
  });
});

describe('isAndroidCompanionApp', () => {
  it('should return true for userAgent containing "Home Assistant" and "Android"', () => {
    expect(isAndroidCompanionApp('Home Assistant/1.0 (Android 1.0; 1.0)')).toBe(true);
  });

  it('should return true for userAgent containing "HomeAssistant" and "Android"', () => {
    expect(isAndroidCompanionApp('HomeAssistant/2.0 (Android 2.0; 2.0)')).toBe(true);
  });

  it('should return false for userAgent not starting with "Home Assistant/" or "HomeAssistant/"', () => {
    expect(isAndroidCompanionApp('Mozilla/5.0')).toBe(false);
  });

  it('should return false for userAgent containing "Home Assistant/" or "HomeAssistant/" and iOS', () => {
    expect(
      isAndroidCompanionApp(
        'Home Assistant/2025.1.1 (io.robbie.HomeAssistant; build:2025.1077; iOS 18.3.0',
      ),
    ).toBe(false);
  });
});

describe('isIOSCompanionApp', () => {
  it('should return true for userAgent containing "Home Assistant" and "iOS"', () => {
    expect(isIOSCompanionApp('Home Assistant/1.0 (iOS 1.0; 1.0)')).toBe(true);
  });

  it('should return true for userAgent containing "HomeAssistant" and "iOS"', () => {
    expect(isIOSCompanionApp('HomeAssistant/2.0 (iOS 2.0; 2.0)')).toBe(true);
  });

  it('should return false for userAgent not starting with "Home Assistant/" or "HomeAssistant/"', () => {
    expect(isIOSCompanionApp('Mozilla/5.0')).toBe(false);
  });

  it('should return false for userAgent containing "Home Assistant/" or "HomeAssistant/" and Android', () => {
    expect(
      isIOSCompanionApp(
        'Home Assistant/2025.1.1 (io.robbie.HomeAssistant; build:2025.1077; Android 18.3.0',
      ),
    ).toBe(false);
  });
});
