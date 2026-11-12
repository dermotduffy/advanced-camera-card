import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { FullscreenProviderFactory } from '../../../src/card-controller/fullscreen/factory';
import { ScreenfullFullScreenProvider } from '../../../src/card-controller/fullscreen/screenfull';
import { WebkitFullScreenProvider } from '../../../src/card-controller/fullscreen/webkit';
import type { WebkitHTMLVideoElement } from '../../../src/types';
import { createCardAPI, setScreenfulEnabled } from '../../test-utils';

// @vitest-environment jsdom
describe('FullscreenProviderFactory', () => {
  const createStubDocument = (element: HTMLElement): Document => {
    const stubDocument = mock<Document>();

    // The no-deprecated check needs to be disabled because mocking
    // `createElement` matches its deprecated overload (the one for legacy
    // elements such as `marquee`), even though this test only ever creates a
    // `video` element.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    stubDocument.createElement.mockReturnValue(element);

    return stubDocument;
  };

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

    vi.stubGlobal('document', createStubDocument(element));

    expect(FullscreenProviderFactory.create(createCardAPI(), vi.fn())).toBeInstanceOf(
      WebkitFullScreenProvider,
    );
  });

  it('should return null without any provider', () => {
    setScreenfulEnabled(false);

    const element = document.createElement('video') as HTMLVideoElement &
      Partial<WebkitHTMLVideoElement>;
    element['webkitEnterFullscreen'] = undefined;

    vi.stubGlobal('document', createStubDocument(element));

    expect(FullscreenProviderFactory.create(createCardAPI(), vi.fn())).toBeNull();
  });
});
