import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { FullscreenProviderFactory } from '../../../src/card-controller/fullscreen/factory';
import { ScreenfullFullScreenProvider } from '../../../src/card-controller/fullscreen/screenfull';
import { WebkitFullScreenProvider } from '../../../src/card-controller/fullscreen/webkit';
import { WebkitHTMLVideoElement } from '../../../src/types';
import { createCardAPI, setScreenfulEnabled } from '../../test-utils';

// @vitest-environment jsdom
describe('FullscreenProviderFactory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return screenful when enabled', () => {
    setScreenfulEnabled(true);

    expect(FullscreenProviderFactory.create(createCardAPI(), vi.fn())).toBeInstanceOf(
      ScreenfullFullScreenProvider,
    );
  });

  it('should return webkit when enabled', () => {
    setScreenfulEnabled(false);

    const element = document.createElement('video') as HTMLVideoElement &
      Partial<WebkitHTMLVideoElement>;
    element['webkitEnterFullscreen'] = vi.fn();

    const stubDocument = mock<Document>();
    stubDocument.createElement.mockReturnValue(element);

    vi.stubGlobal('document', stubDocument);

    expect(FullscreenProviderFactory.create(createCardAPI(), vi.fn())).toBeInstanceOf(
      WebkitFullScreenProvider,
    );
  });

  it('should return null without any provider', () => {
    setScreenfulEnabled(false);

    const element = document.createElement('video') as HTMLVideoElement &
      Partial<WebkitHTMLVideoElement>;
    element['webkitEnterFullscreen'] = undefined;

    const stubDocument = mock<Document>();
    stubDocument.createElement.mockReturnValue(element);

    vi.stubGlobal('document', stubDocument);

    expect(FullscreenProviderFactory.create(createCardAPI(), vi.fn())).toBeNull();
  });
});
