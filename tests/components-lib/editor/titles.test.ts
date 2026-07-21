import { describe, expect, it } from 'vitest';

import {
  getEditorCameraTitle,
  getEditorFolderTitle,
  getEditorTriggerEventTitle,
} from '../../../src/components-lib/editor/titles';
import { createHASS, createStateEntity } from '../../test-utils';

describe('getEditorCameraTitle', () => {
  it('should prefer the configured title', () => {
    expect(getEditorCameraTitle(0, { title: 'Front', id: 'front' })).toBe('Front');
  });

  it('should use the camera entity title', () => {
    const hass = createHASS({
      'camera.front': createStateEntity({
        attributes: { friendly_name: 'Front Door' },
      }),
    });
    expect(getEditorCameraTitle(0, { camera_entity: 'camera.front' }, hass)).toBe(
      'Front Door',
    );
  });

  it('should use the webrtc_card entity', () => {
    expect(getEditorCameraTitle(0, { webrtc_card: { entity: 'camera.front' } })).toBe(
      'camera.front',
    );
  });

  it('should prettify the frigate camera name', () => {
    expect(getEditorCameraTitle(0, { frigate: { camera_name: 'front_door' } })).toBe(
      'Front Door',
    );
  });

  it('should use the camera id', () => {
    expect(getEditorCameraTitle(0, { id: 'front' })).toBe('front');
  });

  it('should fall back to an indexed label', () => {
    expect(getEditorCameraTitle(2, {})).toBe('Camera #2');
    expect(getEditorCameraTitle(2, 'NOT_AN_OBJECT')).toBe('Camera #2');
  });
});

describe('getEditorFolderTitle', () => {
  it('should prefer the configured title', () => {
    expect(getEditorFolderTitle(0, { title: 'Snapshots', id: 'snaps' })).toBe(
      'Snapshots',
    );
  });

  it('should use the folder id', () => {
    expect(getEditorFolderTitle(0, { id: 'snaps' })).toBe('snaps');
  });

  it('should fall back to an indexed label', () => {
    expect(getEditorFolderTitle(1, {})).toBe('Folder #1');
    expect(getEditorFolderTitle(1, 'NOT_AN_OBJECT')).toBe('Folder #1');
  });
});

describe('getEditorTriggerEventTitle', () => {
  it('should prefer the event type', () => {
    expect(getEditorTriggerEventTitle(0, { event_type: 'motion' })).toBe('motion');
  });

  it('should fall back to an indexed label', () => {
    expect(getEditorTriggerEventTitle(3, {})).toBe('Event #3');
    expect(getEditorTriggerEventTitle(3, 'NOT_AN_OBJECT')).toBe('Event #3');
  });
});
