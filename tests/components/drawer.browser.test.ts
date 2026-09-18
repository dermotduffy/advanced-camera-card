import { assert, describe, expect, it } from 'vitest';

import type { AdvancedCameraCardDrawer } from '../../src/components/drawer';
import { MountedCardFactory } from '../browser/mounted-card';
import {
  CARD_INITIALIZED_MESSAGE,
  createGenericCameraHASS,
  createInitializedAutomation,
  createStillImageCardConfig,
} from '../browser/test-utils';

describe('drawer', () => {
  it('should not close the drawer on mouseleave when pinned', async () => {
    const hass = createGenericCameraHASS();
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        live: {
          controls: {
            thumbnails: {
              mode: 'left',
            },
          },
        },
        automations: [createInitializedAutomation()],
      }),
      hass,
    );

    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    const drawer =
      await card.waitForSelector<AdvancedCameraCardDrawer>(
        'advanced-camera-card-drawer[location="left"]',
      );

    drawer.open = true;
    drawer.pinned = true;
    await drawer.updateComplete;

    const sideDrawer = drawer.shadowRoot?.querySelector('side-drawer');
    assert(sideDrawer);

    sideDrawer.dispatchEvent(
      new MouseEvent('mouseleave', { clientX: -100, clientY: -100 }),
    );
    await drawer.updateComplete;

    expect(drawer.open).toBe(true);
  });

  it('should close the drawer on mouseleave when not pinned', async () => {
    const hass = createGenericCameraHASS();
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        live: {
          controls: {
            thumbnails: {
              mode: 'left',
            },
          },
        },
        automations: [createInitializedAutomation()],
      }),
      hass,
    );

    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    const drawer =
      await card.waitForSelector<AdvancedCameraCardDrawer>(
        'advanced-camera-card-drawer[location="left"]',
      );

    drawer.open = true;
    await drawer.updateComplete;

    const sideDrawer = drawer.shadowRoot?.querySelector('side-drawer');
    assert(sideDrawer);

    sideDrawer.dispatchEvent(
      new MouseEvent('mouseleave', { clientX: -100, clientY: -100 }),
    );
    await drawer.updateComplete;

    expect(drawer.open).toBe(false);
  });

  it('should close the drawer when unpinned and not hovered', async () => {
    const hass = createGenericCameraHASS();
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        live: {
          controls: {
            thumbnails: {
              mode: 'left',
            },
          },
        },
        automations: [createInitializedAutomation()],
      }),
      hass,
    );

    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    const drawer =
      await card.waitForSelector<AdvancedCameraCardDrawer>(
        'advanced-camera-card-drawer[location="left"]',
      );

    drawer.open = true;
    drawer.pinned = true;
    await drawer.updateComplete;

    drawer.pinned = false;
    await drawer.updateComplete;

    expect(drawer.open).toBe(false);
  });
});
