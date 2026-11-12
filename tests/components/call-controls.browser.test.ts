import { afterEach, describe, expect, it } from 'vitest';

import '../../src/components/call-controls';

import type { AdvancedCameraCardCallControls } from '../../src/components/call-controls';
import type { CallButtonsConfig } from '../../src/config/schema/live';
import { deepQueryAll } from '../browser/dom';
import { defineHAElementStubs } from '../browser/ha-element-stubs';

const mount = async (options?: {
  answered?: boolean;
  buttonsConfig?: CallButtonsConfig;
  progressAnimated?: boolean;
}): Promise<AdvancedCameraCardCallControls> => {
  defineHAElementStubs();

  const controls = document.createElement('advanced-camera-card-call-controls');
  controls.active = true;
  controls.answered = options?.answered ?? true;
  controls.buttonsConfig = options?.buttonsConfig;
  if (options?.progressAnimated !== undefined) {
    controls.progressAnimated = options.progressAnimated;
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

  it('should spin a ring around a button with progress, not its icon', async () => {
    const controls = await mount({
      answered: false,
      buttonsConfig: { answer: { progress: true } },
    });

    const [reject, answer] = deepQueryAll<HTMLElement>(controls, 'ha-icon-button');
    // The progress class sits next to the button's own emphasis.
    expect([...answer.classList].sort()).toEqual(['positive', 'progress']);
    expect(answer.getAttribute('aria-busy')).toBe('true');
    expect(reject.hasAttribute('aria-busy')).toBe(false);
    expect(getComputedStyle(answer, '::after').animationName).toBe('progress-rotate');
    expect(getComputedStyle(answer).animationName).not.toBe('progress-rotate');
    expect(reject.classList.contains('progress')).toBe(false);
    expect(getComputedStyle(reject, '::after').animationName).toBe('none');
  });

  it('should keep the ring still when animated progress is off', async () => {
    const controls = await mount({
      buttonsConfig: { microphone: { progress: true } },
      progressAnimated: false,
    });

    const microphone = deepQueryAll<HTMLElement>(controls, 'ha-icon-button')[1];
    const ring = getComputedStyle(microphone, '::after');
    expect(ring.content).not.toBe('none');
    expect(ring.animationName).toBe('none');
  });

  it('should stop the ring for reduced motion', async () => {
    const controls = await mount();

    // The browser cannot be switched to reduced motion from here: check the
    // rule that stops the ring is in the stylesheet.
    const rules = (controls.shadowRoot?.adoptedStyleSheets ?? []).flatMap((sheet) => [
      ...sheet.cssRules,
    ]);
    const reduced = rules.find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes('prefers-reduced-motion: reduce'),
    );
    const ring = [...(reduced?.cssRules ?? [])].find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule && rule.selectorText.includes('.progress::after'),
    );
    expect(ring?.style.animationName).toBe('none');
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

  it('should keep its own icons and colours without a configuration', async () => {
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
