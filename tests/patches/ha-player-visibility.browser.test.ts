import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../src/patches/ha-hls-player';
import '../../src/patches/ha-web-rtc-player';

import { sharedDocumentVisibility } from '../../src/utils/document-visibility';
import { defineHAElementStubs } from '../browser/ha-element-stubs';
import { setVisibilityStateAndDispatch } from '../test-utils';

// The member of Home Assistant's players these tests drive, which is protected.
interface PlayerWithVisibility extends HTMLElement {
  updateComplete: Promise<boolean>;
  _handleVisibilityChange?: () => void;
}

const mount = async (
  tag: string,
): Promise<{ player: PlayerWithVisibility; handler: () => void }> => {
  defineHAElementStubs();
  await customElements.whenDefined(tag);

  const player = document.createElement(tag) as PlayerWithVisibility;
  const handler = vi.fn();
  player._handleVisibilityChange = handler;
  document.body.append(player);
  await player.updateComplete;
  return { player, handler };
};

describe.each([
  ['WebRTC', 'advanced-camera-card-ha-web-rtc-player'],
  ['HLS', 'advanced-camera-card-ha-hls-player'],
])('%s player visibility', (_, tag) => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('should keep streaming while the page is hidden on its way into fullscreen', async () => {
    const { handler } = await mount(tag);

    let settle = (): void => {};
    sharedDocumentVisibility.trackFullscreenRequest(
      new Promise<void>((resolve) => (settle = resolve)),
    );
    setVisibilityStateAndDispatch('hidden');
    setVisibilityStateAndDispatch('visible');
    settle();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handler).not.toHaveBeenCalled();
  });

  it('should stop and start the stream when the page is hidden and shown', async () => {
    const { handler } = await mount(tag);

    setVisibilityStateAndDispatch('hidden');
    expect(handler).toHaveBeenCalledTimes(1);

    setVisibilityStateAndDispatch('visible');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should not follow the page once disconnected', async () => {
    const { player, handler } = await mount(tag);
    player.remove();

    setVisibilityStateAndDispatch('hidden');
    setVisibilityStateAndDispatch('visible');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should stop the stream once a fullscreen request ends with the page still hidden', async () => {
    const { handler } = await mount(tag);

    let settle = (): void => {};
    sharedDocumentVisibility.trackFullscreenRequest(
      new Promise<void>((resolve) => (settle = resolve)),
    );
    setVisibilityStateAndDispatch('hidden');
    expect(handler).not.toHaveBeenCalled();

    // E.g. the request was refused, or timed out, while the page stayed hidden.
    settle();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handler).toHaveBeenCalledTimes(1);

    setVisibilityStateAndDispatch('visible');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should follow the page once per change after a reconnect', async () => {
    const { player, handler } = await mount(tag);
    player.remove();
    document.body.append(player);

    setVisibilityStateAndDispatch('hidden');
    expect(handler).toHaveBeenCalledTimes(1);
    setVisibilityStateAndDispatch('visible');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("should leave a player without its own handler to the frontend's listener", async () => {
    defineHAElementStubs();
    await customElements.whenDefined(tag);

    // The frontend registers whatever it holds; here a handler that is not the
    // player's own field, which the card must not take over.
    const handler = vi.fn();
    const player = document.createElement(tag) as PlayerWithVisibility;
    Object.setPrototypeOf(
      player,
      Object.create(Object.getPrototypeOf(player), {
        _handleVisibilityChange: { value: handler, configurable: true },
      }),
    );
    delete (player as { _handleVisibilityChange?: unknown })._handleVisibilityChange;
    document.body.append(player);
    await player.updateComplete;

    let settle = (): void => {};
    sharedDocumentVisibility.trackFullscreenRequest(
      new Promise<void>((resolve) => (settle = resolve)),
    );
    setVisibilityStateAndDispatch('hidden');

    // The frontend's own listener still reacts, as without the card.
    expect(handler).toHaveBeenCalledTimes(1);

    settle();
    setVisibilityStateAndDispatch('visible');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
