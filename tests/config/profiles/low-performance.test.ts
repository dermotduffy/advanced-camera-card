import { describe, expect, it } from 'vitest';
import { getConfigValue } from '../../../src/config/management';
import { LOW_PERFORMANCE_PROFILE } from '../../../src/config/profiles/low-performance';
import { setProfiles } from '../../../src/config/profiles/set-profiles';
import { advancedCameraCardConfigSchema } from '../../../src/config/schema/types';
import { createRawConfig } from '../../test-utils';

describe('LOW_PERFORMANCE_PROFILE', () => {
  it('should contain expected defaults', () => {
    expect(LOW_PERFORMANCE_PROFILE).toEqual({
      'cameras_global.image.refresh_seconds': 10,
      'cameras_global.live_provider': 'image',
      'cameras_global.triggers.occupancy': false,
      'live.auto_mute': [],
      'live.controls.thumbnails.mode': 'none',
      'live.controls.thumbnails.show_details': false,
      'live.controls.thumbnails.show_download_control': false,
      'live.controls.thumbnails.show_favorite_control': false,
      'live.controls.thumbnails.show_timeline_control': false,
      'live.controls.timeline.show_recordings': false,
      'live.draggable': false,
      'live.lazy_unload': ['unselected', 'hidden'],
      'live.show_image_during_load': false,
      'live.transition_effect': 'none',
      'media_gallery.controls.thumbnails.show_details': false,
      'media_gallery.controls.thumbnails.show_download_control': false,
      'media_gallery.controls.thumbnails.show_favorite_control': false,
      'media_gallery.controls.thumbnails.show_timeline_control': false,
      'media_viewer.auto_mute': [],
      'media_viewer.auto_pause': [],
      'media_viewer.auto_play': [],
      'media_viewer.controls.next_previous.style': 'chevrons',
      'media_viewer.controls.thumbnails.mode': 'none',
      'media_viewer.controls.thumbnails.show_details': false,
      'media_viewer.controls.thumbnails.show_download_control': false,
      'media_viewer.controls.thumbnails.show_favorite_control': false,
      'media_viewer.controls.thumbnails.show_timeline_control': false,
      'media_viewer.controls.timeline.show_recordings': false,
      'media_viewer.draggable': false,
      'media_viewer.snapshot_click_plays_clip': false,
      'media_viewer.transition_effect': 'none',
      'menu.buttons.iris.enabled': false,
      'menu.buttons.media_player.enabled': false,
      'menu.buttons.timeline.enabled': false,
      'menu.style': 'outside',
      'performance.features.animated_progress_indicator': false,
      'performance.features.card_loading_indicator': false,
      'performance.features.card_loading_effects': false,
      'performance.features.max_simultaneous_engine_requests': 1,
      'performance.features.media_chunk_size': 10,
      'performance.style.border_radius': false,
      'performance.style.box_shadow': false,
      'status_bar.style': 'none',
      'timeline.controls.thumbnails.mode': 'none',
      'timeline.controls.thumbnails.show_details': false,
      'timeline.controls.thumbnails.show_download_control': false,
      'timeline.controls.thumbnails.show_favorite_control': false,
      'timeline.controls.thumbnails.show_timeline_control': false,
      'timeline.show_recordings': false,
      'view.triggers.actions.trigger': 'none',
    });
  });

  it('should apply each profile value to the merged config', () => {
    const rawInputConfig = createRawConfig();
    const parsedConfig = advancedCameraCardConfigSchema.parse(rawInputConfig);

    setProfiles(rawInputConfig, parsedConfig, ['low-performance']);

    for (const [path, expected] of Object.entries(LOW_PERFORMANCE_PROFILE)) {
      expect(getConfigValue(parsedConfig, path), path).toEqual(expected);
    }
  });

  it('should preserve user-specified values over profile values', () => {
    const rawInputConfig = createRawConfig({
      menu: { style: 'hover' },
      live: { transition_effect: 'slide' },
    });
    const parsedConfig = advancedCameraCardConfigSchema.parse(rawInputConfig);

    setProfiles(rawInputConfig, parsedConfig, ['low-performance']);

    expect(parsedConfig.menu.style).toBe('hover');
    expect(parsedConfig.live.transition_effect).toBe('slide');

    // Non-overridden profile values should still be applied.
    expect(parsedConfig.live.draggable).toBe(false);
    expect(parsedConfig.performance.features.media_chunk_size).toBe(10);
  });

  it('should be parseable after application', () => {
    const rawInputConfig = createRawConfig();
    const parsedConfig = advancedCameraCardConfigSchema.parse(rawInputConfig);

    setProfiles(rawInputConfig, parsedConfig, ['low-performance']);

    const parseResult = advancedCameraCardConfigSchema.safeParse(parsedConfig);
    expect(parseResult.success, parseResult.error?.toString()).toBeTruthy();
  });
});
