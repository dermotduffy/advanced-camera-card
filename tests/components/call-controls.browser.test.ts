import { afterEach, describe, expect, it } from 'vitest';

import '../../src/components/call-controls';

import type { AdvancedCameraCardCallControls } from '../../src/components/call-controls';
import { deepQueryAll } from '../browser/dom';
import { defineHAElementStubs } from '../browser/ha-element-stubs';

const mount = async (options?: {
  answered?: boolean;
}): Promise<AdvancedCameraCardCallControls> => {
  defineHAElementStubs();

  const controls = document.createElement('advanced-camera-card-call-controls');
  controls.active = true;
  controls.answered = options?.answered ?? true;
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
});
