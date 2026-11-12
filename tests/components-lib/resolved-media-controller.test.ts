import type { ReactiveControllerHost } from 'lit';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { ResolvedMediaController } from '../../src/components-lib/resolved-media-controller';
import { ResolvedMediaCache, resolveMedia } from '../../src/ha/resolved-media';
import type * as HAResolvedMedia from '../../src/ha/resolved-media';
import type { HomeAssistant, ResolvedMedia } from '../../src/ha/types';
import { createHASS, flushPromises } from '../test-utils';

vi.mock('../../src/ha/resolved-media', async (importOriginal) => ({
  ...(await importOriginal<typeof HAResolvedMedia>()),
  resolveMedia: vi.fn(),
}));

const CONTENT_ID = 'media-source://media_source/local/event.mp4';
const OTHER_CONTENT_ID = 'media-source://media_source/local/other.mp4';

const createResolvedMedia = (url = 'http://media'): ResolvedMedia => ({
  mime_type: 'video/mp4',
  url: url,
});

describe('ResolvedMediaController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('should register itself with the host', () => {
    const host = mock<ReactiveControllerHost>();
    const controller = new ResolvedMediaController(host, () => ({}));

    expect(host.addController).toHaveBeenCalledWith(controller);
    expect(controller.getValue()).toBeNull();
  });

  it('should resolve media and request a host update', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const cache = new ResolvedMediaCache();
    const resolvedMedia = createResolvedMedia();
    vi.mocked(resolveMedia).mockResolvedValue(resolvedMedia);

    const controller = new ResolvedMediaController(host, () => ({
      hass: hass,
      contentID: CONTENT_ID,
      cache: cache,
    }));

    await controller.hostUpdate();

    expect(resolveMedia).toHaveBeenCalledWith(hass, CONTENT_ID, cache);
    expect(controller.getValue()).toBe(resolvedMedia);
    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it('should resolve media without a cache', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    vi.mocked(resolveMedia).mockResolvedValue(createResolvedMedia());

    const controller = new ResolvedMediaController(host, () => ({
      hass: hass,
      contentID: CONTENT_ID,
    }));

    await controller.hostUpdate();

    expect(resolveMedia).toHaveBeenCalledWith(hass, CONTENT_ID, null);
  });

  it('should not resolve media without hass', async () => {
    const controller = new ResolvedMediaController(
      mock<ReactiveControllerHost>(),
      () => ({
        contentID: CONTENT_ID,
      }),
    );

    await controller.hostUpdate();

    expect(resolveMedia).not.toHaveBeenCalled();
    expect(controller.getValue()).toBeNull();
  });

  it('should not resolve media without a content ID', async () => {
    const controller = new ResolvedMediaController(
      mock<ReactiveControllerHost>(),
      () => ({
        hass: createHASS(),
        contentID: null,
      }),
    );

    await controller.hostUpdate();

    expect(resolveMedia).not.toHaveBeenCalled();
    expect(controller.getValue()).toBeNull();
  });

  it('should clear the value when the inputs are cleared', async () => {
    const hass = createHASS();
    const options: { hass?: ReturnType<typeof createHASS>; contentID: string | null } = {
      hass: hass,
      contentID: CONTENT_ID,
    };
    vi.mocked(resolveMedia).mockResolvedValue(createResolvedMedia());

    const controller = new ResolvedMediaController(
      mock<ReactiveControllerHost>(),
      () => options,
    );

    await controller.hostUpdate();
    expect(controller.getValue()).not.toBeNull();

    options.contentID = null;
    await controller.hostUpdate();

    expect(controller.getValue()).toBeNull();
  });

  it('should clear the value before resolving changed inputs', async () => {
    const options = { hass: createHASS(), contentID: CONTENT_ID };
    vi.mocked(resolveMedia).mockResolvedValue(createResolvedMedia());

    const controller = new ResolvedMediaController(
      mock<ReactiveControllerHost>(),
      () => options,
    );

    await controller.hostUpdate();
    expect(controller.getValue()).not.toBeNull();

    options.contentID = OTHER_CONTENT_ID;
    const update = controller.hostUpdate();

    // The value must not survive into the gap while the new content ID is
    // being resolved.
    expect(controller.getValue()).toBeNull();

    await update;
  });

  it('should not request the same inputs again', async () => {
    vi.mocked(resolveMedia).mockResolvedValue(createResolvedMedia());

    const controller = new ResolvedMediaController(
      mock<ReactiveControllerHost>(),
      () => ({
        hass: createHASS(),
        contentID: CONTENT_ID,
      }),
    );

    await controller.hostUpdate();
    await controller.hostUpdate();

    expect(resolveMedia).toHaveBeenCalledTimes(1);
  });

  it('should not request again after a failure', async () => {
    vi.mocked(resolveMedia).mockResolvedValue(null);

    const controller = new ResolvedMediaController(
      mock<ReactiveControllerHost>(),
      () => ({
        hass: createHASS(),
        contentID: CONTENT_ID,
      }),
    );

    await controller.hostUpdate();
    await controller.hostUpdate();

    expect(resolveMedia).toHaveBeenCalledTimes(1);
    expect(controller.getValue()).toBeNull();
  });

  it('should apply a cached value without awaiting', () => {
    const host = mock<ReactiveControllerHost>();
    const cache = new ResolvedMediaCache();
    const resolvedMedia = createResolvedMedia();
    cache.set(CONTENT_ID, resolvedMedia);

    const controller = new ResolvedMediaController(host, () => ({
      hass: createHASS(),
      contentID: CONTENT_ID,
      cache: cache,
    }));

    controller.hostUpdate();

    expect(controller.getValue()).toBe(resolvedMedia);
    expect(resolveMedia).not.toHaveBeenCalled();
  });

  it('should ignore a slow result superseded by a cached value', async () => {
    const cache = new ResolvedMediaCache();
    const cached = createResolvedMedia('http://cached');
    cache.set(OTHER_CONTENT_ID, cached);

    const options = { hass: createHASS(), contentID: CONTENT_ID, cache: cache };
    const deferred: { respond?: (value: ResolvedMedia) => void } = {};
    vi.mocked(resolveMedia).mockReturnValueOnce(
      new Promise<ResolvedMedia>((resolve) => {
        deferred.respond = resolve;
      }),
    );

    const controller = new ResolvedMediaController(
      mock<ReactiveControllerHost>(),
      () => options,
    );

    const slowUpdate = controller.hostUpdate();

    options.contentID = OTHER_CONTENT_ID;
    controller.hostUpdate();
    expect(controller.getValue()).toBe(cached);

    assert(deferred.respond);
    deferred.respond(createResolvedMedia('http://slow'));
    await slowUpdate;
    await flushPromises();

    expect(controller.getValue()).toBe(cached);
  });

  it('should treat an absent cache and a null cache as the same inputs', async () => {
    const options: { hass: HomeAssistant; contentID: string; cache?: null } = {
      hass: createHASS(),
      contentID: CONTENT_ID,
    };
    vi.mocked(resolveMedia).mockResolvedValue(createResolvedMedia());

    const controller = new ResolvedMediaController(
      mock<ReactiveControllerHost>(),
      () => options,
    );

    await controller.hostUpdate();

    options.cache = null;
    await controller.hostUpdate();

    expect(resolveMedia).toHaveBeenCalledTimes(1);
  });

  it('should request again when the cache changes', async () => {
    const options = {
      hass: createHASS(),
      contentID: CONTENT_ID,
      cache: new ResolvedMediaCache(),
    };
    vi.mocked(resolveMedia).mockResolvedValue(createResolvedMedia());

    const controller = new ResolvedMediaController(
      mock<ReactiveControllerHost>(),
      () => options,
    );

    await controller.hostUpdate();

    options.cache = new ResolvedMediaCache();
    await controller.hostUpdate();

    expect(resolveMedia).toHaveBeenCalledTimes(2);
  });

  it('should ignore a slow result for superseded inputs', async () => {
    const options = { hass: createHASS(), contentID: CONTENT_ID };
    const slow = createResolvedMedia('http://slow');
    const fast = createResolvedMedia('http://fast');

    const deferred: { respond?: (value: ResolvedMedia) => void } = {};
    vi.mocked(resolveMedia).mockReturnValueOnce(
      new Promise<ResolvedMedia>((resolve) => {
        deferred.respond = resolve;
      }),
    );

    const controller = new ResolvedMediaController(
      mock<ReactiveControllerHost>(),
      () => options,
    );

    const slowUpdate = controller.hostUpdate();

    options.contentID = OTHER_CONTENT_ID;
    vi.mocked(resolveMedia).mockResolvedValueOnce(fast);
    await controller.hostUpdate();

    expect(controller.getValue()).toBe(fast);

    assert(deferred.respond);
    deferred.respond(slow);
    await slowUpdate;
    await flushPromises();

    expect(controller.getValue()).toBe(fast);
  });

  it('should ignore an in-flight result once disconnected', async () => {
    const host = mock<ReactiveControllerHost>();
    const deferred: { respond?: (value: ResolvedMedia) => void } = {};
    vi.mocked(resolveMedia).mockReturnValue(
      new Promise<ResolvedMedia>((resolve) => {
        deferred.respond = resolve;
      }),
    );

    const controller = new ResolvedMediaController(host, () => ({
      hass: createHASS(),
      contentID: CONTENT_ID,
    }));

    const update = controller.hostUpdate();
    controller.hostDisconnected();

    assert(deferred.respond);
    deferred.respond(createResolvedMedia());
    await update;
    await flushPromises();

    expect(controller.getValue()).toBeNull();
    expect(host.requestUpdate).not.toHaveBeenCalled();
  });

  it('should resolve again after reconnecting', async () => {
    vi.mocked(resolveMedia).mockResolvedValue(createResolvedMedia());

    const controller = new ResolvedMediaController(
      mock<ReactiveControllerHost>(),
      () => ({
        hass: createHASS(),
        contentID: CONTENT_ID,
      }),
    );

    await controller.hostUpdate();
    controller.hostDisconnected();
    await controller.hostUpdate();

    expect(resolveMedia).toHaveBeenCalledTimes(2);
  });
});
