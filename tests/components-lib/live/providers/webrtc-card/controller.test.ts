import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { Camera } from '../../../../../src/camera-manager/camera';
import {
  WEBRTC_CARD_ELEMENT_NAME,
  WebRTCCardController,
} from '../../../../../src/components-lib/live/providers/webrtc-card/controller';
import type { HomeAssistant, LovelaceCardConfig } from '../../../../../src/ha/types';
import { createCameraConfig } from '../../../../config/test-utils';
import { createHASS, createLitElement } from '../../../../test-utils';

// Configuring this entity makes the stand-in card below reject the
// configuration, as AlexxIT's card does when given no usable stream.
const REJECTED_ENTITY = 'camera.rejected';

class TestWebRTCCard extends HTMLElement {
  public hass?: HomeAssistant;
  public setConfig = vi.fn((config: LovelaceCardConfig): void => {
    if (config.entity === REJECTED_ENTITY) {
      throw new Error('Missing `url` or `entity` or `streams`');
    }
  });
}

customElements.define(WEBRTC_CARD_ELEMENT_NAME, TestWebRTCCard);

const asTestCard = (element: HTMLElement | null): TestWebRTCCard | null =>
  element instanceof TestWebRTCCard ? element : null;

const createCamera = (options?: {
  webrtc_card?: Record<string, unknown>;
  webrtcCardEndpoint?: string;
}): Camera => {
  const camera = mock<Camera>();
  camera.getConfig.mockReturnValue(
    createCameraConfig({ webrtc_card: options?.webrtc_card }),
  );
  camera.getEndpoints.mockReturnValue(
    options?.webrtcCardEndpoint
      ? { webrtcCard: { endpoint: options.webrtcCardEndpoint } }
      : {},
  );
  return camera;
};

const createController = (options?: { destroyCallback?: () => void }) => {
  const host = createLitElement();
  const destroyCallback = options?.destroyCallback ?? vi.fn();
  const controller = new WebRTCCardController(host, { destroyCallback });
  return { host, controller, destroyCallback };
};

const createRequest = (options?: {
  webrtcCardEndpoint?: string;
  hass?: HomeAssistant;
}) => ({
  camera: createCamera({
    webrtcCardEndpoint: options?.webrtcCardEndpoint ?? 'camera.office',
  }),
  hass: options?.hass ?? createHASS(),
});

// @vitest-environment jsdom
describe('WebRTCCardController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register itself with the host', () => {
    const { host, controller } = createController();

    expect(host.addController).toHaveBeenCalledWith(controller);
  });

  it('should await the WebRTC card registration', async () => {
    const { controller } = createController();

    await expect(controller.awaitRegistration()).resolves.toBeUndefined();
  });

  describe('should not create an element', () => {
    it('without a camera', () => {
      const { controller } = createController();

      expect(controller.getElement({ hass: createHASS() })).toBeNull();
    });

    it('without hass', () => {
      const { controller } = createController();

      expect(controller.getElement({ camera: createCamera() })).toBeNull();
    });
  });

  describe('should create an element', () => {
    it('with the card defaults', () => {
      const { controller } = createController();
      const hass = createHASS();

      const element = controller.getElement(createRequest({ hass }));

      expect(asTestCard(element)?.setConfig).toHaveBeenCalledWith({
        type: 'custom:webrtc-camera',
        intersection: 0,
        muted: true,
        entity: 'camera.office',
      });
      expect(asTestCard(element)?.hass).toBe(hass);
    });

    it('with user configuration overriding the defaults', () => {
      const { controller } = createController();

      const element = controller.getElement({
        camera: createCamera({
          webrtc_card: { muted: false, url: 'https://camera' },
          webrtcCardEndpoint: 'camera.office',
        }),
        hass: createHASS(),
      });

      expect(asTestCard(element)?.setConfig).toHaveBeenCalledWith({
        type: 'custom:webrtc-camera',
        intersection: 0,
        muted: false,
        url: 'https://camera',
      });
    });

    it('without an endpoint when the user configures an entity', () => {
      const { controller } = createController();

      const element = controller.getElement({
        camera: createCamera({
          webrtc_card: { entity: 'camera.configured' },
          webrtcCardEndpoint: 'camera.office',
        }),
        hass: createHASS(),
      });

      expect(asTestCard(element)?.setConfig).toHaveBeenCalledWith({
        type: 'custom:webrtc-camera',
        intersection: 0,
        muted: true,
        entity: 'camera.configured',
      });
    });

    it('without an endpoint at all', () => {
      const { controller } = createController();

      const element = controller.getElement({
        camera: createCamera(),
        hass: createHASS(),
      });

      expect(asTestCard(element)?.setConfig).toHaveBeenCalledWith({
        type: 'custom:webrtc-camera',
        intersection: 0,
        muted: true,
      });
    });
  });

  describe('should reuse the element', () => {
    it('when nothing changes', () => {
      const { controller, destroyCallback } = createController();
      const request = createRequest();

      const element = controller.getElement(request);

      expect(controller.getElement(request)).toBe(element);
      expect(destroyCallback).not.toHaveBeenCalled();
    });

    it('when an equivalent camera replaces the old one', () => {
      const { controller, destroyCallback } = createController();

      const element = controller.getElement(createRequest());

      expect(controller.getElement(createRequest())).toBe(element);
      expect(destroyCallback).not.toHaveBeenCalled();
    });

    it('and give it the latest hass', () => {
      const { controller } = createController();

      const element = controller.getElement(createRequest());

      const hass = createHASS();
      controller.getElement(createRequest({ hass }));

      expect(asTestCard(element)?.hass).toBe(hass);
    });
  });

  describe('should rebuild the element', () => {
    it('when the resolved configuration changes', () => {
      const { controller, destroyCallback } = createController();

      const element = controller.getElement(createRequest());

      expect(
        controller.getElement(createRequest({ webrtcCardEndpoint: 'camera.kitchen' })),
      ).not.toBe(element);
      expect(destroyCallback).toHaveBeenCalledOnce();
    });
  });

  describe('should discard the element', () => {
    it('when the inputs are no longer sufficient', () => {
      const { controller, destroyCallback } = createController();

      controller.getElement(createRequest());

      expect(controller.getElement({ hass: createHASS() })).toBeNull();
      expect(destroyCallback).toHaveBeenCalledOnce();
    });

    it('when the WebRTC card rejects the configuration', () => {
      const { controller, destroyCallback } = createController();

      controller.getElement(createRequest());

      expect(() =>
        controller.getElement(createRequest({ webrtcCardEndpoint: REJECTED_ENTITY })),
      ).toThrow('Missing `url` or `entity` or `streams`');
      expect(destroyCallback).toHaveBeenCalledOnce();

      // The rejected element must not be cached: the next call rebuilds rather
      // than handing back a stale element.
      expect(controller.getElement(createRequest())).not.toBeNull();
      expect(destroyCallback).toHaveBeenCalledOnce();
    });

    it('when the host disconnects', () => {
      const { controller, destroyCallback } = createController();

      const element = controller.getElement(createRequest());
      controller.hostDisconnected();

      expect(destroyCallback).toHaveBeenCalledOnce();
      expect(controller.getElement(createRequest())).not.toBe(element);
    });
  });

  it('should not invoke the destroy callback when there is no element', () => {
    const { controller, destroyCallback } = createController();

    controller.hostDisconnected();

    expect(destroyCallback).not.toHaveBeenCalled();
  });
});
