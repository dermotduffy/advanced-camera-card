import { describe, expect, it, vi } from 'vitest';

import {
  HA_CAMERA_STREAM_MUTE_CHANGE_EVENT,
  HAStreamMuteController,
} from '../../../src/components-lib/live/ha-stream-mute-controller';
import { createLitElement } from '../../test-utils';

// @vitest-environment jsdom

interface ControllerState {
  cameraEntityID: string | null;
  preferAudioStream: boolean;
}

const createController = (state: ControllerState) => {
  const host = createLitElement();
  const controller = new HAStreamMuteController(host, {
    getCameraEntityID: () => state.cameraEntityID,
    getPreferAudioStream: () => state.preferAudioStream,
  });
  return { host, controller };
};

const dispatchMuteChange = (host: HTMLElement, muted: boolean): void => {
  host.dispatchEvent(
    new CustomEvent(HA_CAMERA_STREAM_MUTE_CHANGE_EVENT, { detail: { muted } }),
  );
};

describe('HAStreamMuteController', () => {
  it('should add itself as a controller to the host', () => {
    const host = createLitElement();
    const controller = new HAStreamMuteController(host, {
      getCameraEntityID: () => 'camera.test',
      getPreferAudioStream: () => false,
    });
    expect(host.addController).toHaveBeenCalledWith(controller);
  });

  it('should default both the intended and output mute to muted', () => {
    const { controller } = createController({
      cameraEntityID: 'camera.test',
      preferAudioStream: false,
    });
    expect(controller.getIntendedMute()).toBe(true);
    expect(controller.getOutputMute()).toBe(true);
  });

  describe('seeding on a camera change', () => {
    it('should seed the intended mute as muted when audio is not intended', () => {
      const { controller } = createController({
        cameraEntityID: 'camera.test',
        preferAudioStream: false,
      });
      controller.hostUpdate();
      expect(controller.getIntendedMute()).toBe(true);
    });

    it('should seed the intended mute as unmuted when audio is intended', () => {
      const { controller } = createController({
        cameraEntityID: 'camera.test',
        preferAudioStream: true,
      });
      controller.hostUpdate();
      expect(controller.getIntendedMute()).toBe(false);
    });
  });

  describe('on a visible-leaf mute change', () => {
    it('should mirror the output mute', () => {
      const { host, controller } = createController({
        cameraEntityID: 'camera.test',
        preferAudioStream: false,
      });
      controller.hostConnected();
      controller.hostUpdate();

      dispatchMuteChange(host, false);
      expect(controller.getOutputMute()).toBe(false);

      dispatchMuteChange(host, true);
      expect(controller.getOutputMute()).toBe(true);
    });

    it('should flip the intended mute to unmuted on the first unmute', () => {
      const { host, controller } = createController({
        cameraEntityID: 'camera.test',
        preferAudioStream: false,
      });
      controller.hostConnected();
      controller.hostUpdate();
      expect(controller.getIntendedMute()).toBe(true);

      dispatchMuteChange(host, false);
      expect(controller.getIntendedMute()).toBe(false);
    });

    it('should not flip the intended mute back when muted again', () => {
      const { host, controller } = createController({
        cameraEntityID: 'camera.test',
        preferAudioStream: false,
      });
      controller.hostConnected();
      controller.hostUpdate();

      dispatchMuteChange(host, false);
      dispatchMuteChange(host, true);

      expect(controller.getIntendedMute()).toBe(false);
      expect(controller.getOutputMute()).toBe(true);
    });

    it('should request a host update only when the state changes', () => {
      const { host, controller } = createController({
        cameraEntityID: 'camera.test',
        preferAudioStream: false,
      });
      controller.hostConnected();
      controller.hostUpdate();
      vi.mocked(host.requestUpdate).mockClear();

      // Already muted: no change.
      dispatchMuteChange(host, true);
      expect(host.requestUpdate).not.toHaveBeenCalled();

      // Unmute: change.
      dispatchMuteChange(host, false);
      expect(host.requestUpdate).toHaveBeenCalledTimes(1);
    });

    it('should ignore malformed mute-change events', () => {
      const { host, controller } = createController({
        cameraEntityID: 'camera.test',
        preferAudioStream: false,
      });
      controller.hostConnected();
      controller.hostUpdate();
      vi.mocked(host.requestUpdate).mockClear();

      const eventName = HA_CAMERA_STREAM_MUTE_CHANGE_EVENT;
      host.dispatchEvent(new Event(eventName)); // not a CustomEvent
      host.dispatchEvent(new CustomEvent(eventName)); // detail is null
      host.dispatchEvent(new CustomEvent(eventName, { detail: 'x' })); // detail not an object
      host.dispatchEvent(new CustomEvent(eventName, { detail: {} })); // no `muted`
      host.dispatchEvent(new CustomEvent(eventName, { detail: { muted: 1 } })); // `muted` not boolean

      expect(host.requestUpdate).not.toHaveBeenCalled();
      expect(controller.getIntendedMute()).toBe(true);
      expect(controller.getOutputMute()).toBe(true);
    });
  });

  describe('resetting on a camera change', () => {
    it('should reseed the intended mute and clear the output mute on a new camera', () => {
      const state: ControllerState = {
        cameraEntityID: 'camera.one',
        preferAudioStream: false,
      };
      const { host, controller } = createController(state);
      controller.hostConnected();
      controller.hostUpdate();

      dispatchMuteChange(host, false);
      expect(controller.getIntendedMute()).toBe(false);
      expect(controller.getOutputMute()).toBe(false);

      state.cameraEntityID = 'camera.two';
      controller.hostUpdate();

      expect(controller.getIntendedMute()).toBe(true);
      expect(controller.getOutputMute()).toBe(true);
    });

    it('should not reset when only the audio intent changes', () => {
      const state: ControllerState = {
        cameraEntityID: 'camera.one',
        preferAudioStream: false,
      };
      const { host, controller } = createController(state);
      controller.hostConnected();
      controller.hostUpdate();

      dispatchMuteChange(host, false);
      expect(controller.getIntendedMute()).toBe(false);

      state.preferAudioStream = true;
      controller.hostUpdate();

      // Same camera: the user's unmute is preserved, not reseeded.
      expect(controller.getIntendedMute()).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('should stop responding after disconnect', () => {
      const { host, controller } = createController({
        cameraEntityID: 'camera.test',
        preferAudioStream: false,
      });
      controller.hostConnected();
      controller.hostUpdate();

      controller.hostDisconnected();
      dispatchMuteChange(host, false);

      expect(controller.getIntendedMute()).toBe(true);
      expect(controller.getOutputMute()).toBe(true);
    });
  });
});
