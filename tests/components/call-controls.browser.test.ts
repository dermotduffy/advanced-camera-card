import { afterEach, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

import '../../src/components/call-controls';

import type { AdvancedCameraCardCallControls } from '../../src/components/call-controls';
import type { CallButtonsConfig } from '../../src/config/schema/live';
import { deepQueryAll } from '../browser/dom';
import { defineHAElementStubs } from '../browser/ha-element-stubs';

declare module 'vitest/browser' {
  interface BrowserCommands {
    emulateReducedMotion: (
      reducedMotion: 'reduce' | 'no-preference' | null,
    ) => Promise<void>;
  }
}

const mount = async (options?: {
  answered?: boolean;
  connecting?: boolean;
  buttonsConfig?: CallButtonsConfig;
  animationOverride?: string;
}): Promise<AdvancedCameraCardCallControls> => {
  defineHAElementStubs();

  const controls = document.createElement('advanced-camera-card-call-controls');
  controls.active = true;
  controls.answered = options?.answered ?? true;
  controls.connecting = options?.connecting ?? false;
  controls.buttonsConfig = options?.buttonsConfig;
  if (options?.animationOverride) {
    controls.style.setProperty(
      '--advanced-camera-card-in-progress-animation-override',
      options.animationOverride,
    );
  }
  document.body.append(controls);

  await controls.updateComplete;
  return controls;
};

const getButtonIcons = (controls: AdvancedCameraCardCallControls): (string | null)[] =>
  deepQueryAll(controls, 'ha-icon-button').map((button) => {
    // Verify the icons are not ha-icon.
    expect(button.querySelector('ha-icon')).toBeNull();

    const icon = button.querySelector('advanced-camera-card-icon');
    return icon?.icon?.icon ?? null;
  });

const expectStillRing = (button: HTMLElement): void => {
  const ring = getComputedStyle(button, '::after');
  expect(ring.content).not.toBe('none');
  expect(ring.animationName).toBe('none');
};

afterEach(() => {
  document.querySelectorAll('advanced-camera-card-call-controls').forEach((controls) => {
    controls.remove();
  });
});

describe('AdvancedCameraCardCallControls', () => {
  it('should render the answered buttons with the card icon component', async () => {
    const controls = await mount();

    expect(getButtonIcons(controls)).toEqual([
      'mdi:phone-hangup',
      'mdi:microphone-off',
      'mdi:volume-off',
    ]);
  });

  it('should render the unanswered buttons with the card icon component', async () => {
    const controls = await mount({ answered: false });

    expect(getButtonIcons(controls)).toEqual(['mdi:phone-hangup', 'mdi:phone']);
  });

  it("should use a configured icon in place of the button's own", async () => {
    const controls = await mount({
      buttonsConfig: { microphone: { icon: 'mdi:microphone-settings' } },
    });

    expect(getButtonIcons(controls)).toEqual([
      'mdi:phone-hangup',
      'mdi:microphone-settings',
      'mdi:volume-off',
    ]);
  });

  it('should draw a ring around a button in progress', async () => {
    const controls = await mount({
      answered: false,
      buttonsConfig: { answer: { in_progress: true } },
    });

    const [reject, answer] = deepQueryAll<HTMLElement>(controls, 'ha-icon-button');

    // The in-progress class sits next to the button's own emphasis.
    expect([...answer.classList].sort()).toEqual(['in-progress', 'positive']);
    expect(answer.getAttribute('aria-busy')).toBe('true');
    expect(reject.hasAttribute('aria-busy')).toBe(false);
    expect(getComputedStyle(answer, '::after').animationName).toBe('in-progress-rotate');
    expect(getComputedStyle(answer).animationName).not.toBe('in-progress-rotate');
    expect(reject.classList.contains('in-progress')).toBe(false);
    expect(getComputedStyle(reject, '::after').animationName).toBe('none');
  });

  it('should draw a ring around the answer button while the call connects', async () => {
    const controls = await mount({ answered: false, connecting: true });

    const [reject, answer] = deepQueryAll<HTMLElement>(controls, 'ha-icon-button');

    expect(answer.classList.contains('in-progress')).toBe(true);
    expect(answer.getAttribute('aria-busy')).toBe('true');
    expect(getComputedStyle(answer, '::after').animationName).toBe('in-progress-rotate');
    expect(reject.classList.contains('in-progress')).toBe(false);
    expect(reject.hasAttribute('aria-busy')).toBe(false);
  });

  it('should keep the ring still when the animation is overridden', async () => {
    const controls = await mount({
      buttonsConfig: { microphone: { in_progress: true } },
      animationOverride: 'none',
    });

    expectStillRing(deepQueryAll<HTMLElement>(controls, 'ha-icon-button')[1]);
  });

  it('should keep the ring still with a reduced motion preference', async () => {
    const controls = await mount({
      buttonsConfig: { microphone: { in_progress: true } },
    });

    // WebKit ignores a preference change for shadow root styles that no
    // mounted element uses, so the preference changes only while the controls
    // are mounted.
    await commands.emulateReducedMotion('reduce');
    try {
      expectStillRing(deepQueryAll<HTMLElement>(controls, 'ha-icon-button')[1]);
    } finally {
      await commands.emulateReducedMotion(null);
    }
  });

  it('should apply a configured style to the button and its icon', async () => {
    const controls = await mount({
      answered: false,
      buttonsConfig: { answer: { style: { color: 'rgb(0, 128, 0)' } } },
    });

    const [reject, answer] = deepQueryAll<HTMLElement>(controls, 'ha-icon-button');
    expect(answer.style.color).toBe('rgb(0, 128, 0)');
    expect(answer.style.getPropertyValue('--state-icon-color')).toBe('rgb(0, 128, 0)');
    expect(getComputedStyle(answer).color).toBe('rgb(0, 128, 0)');
    expect(reject.getAttribute('style') ?? '').toBe('');
  });

  it('should keep its own icons and colors without a configuration', async () => {
    const controls = await mount({ buttonsConfig: {} });

    expect(getButtonIcons(controls)).toEqual([
      'mdi:phone-hangup',
      'mdi:microphone-off',
      'mdi:volume-off',
    ]);
    for (const button of deepQueryAll<HTMLElement>(controls, 'ha-icon-button')) {
      expect(button.getAttribute('style') ?? '').toBe('');
    }
  });
});
