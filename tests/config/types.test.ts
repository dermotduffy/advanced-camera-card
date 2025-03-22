import { describe, expect, it } from 'vitest';
import { advancedCameraCardCustomActionsBaseSchema } from '../../src/config/schema/actions/custom/base';
import { statusBarActionConfigSchema } from '../../src/config/schema/actions/types';
import { cameraConfigSchema } from '../../src/config/schema/cameras';
import { advancedCameraCardConditionSchema } from '../../src/config/schema/conditions/types';
import { dimensionsConfigSchema } from '../../src/config/schema/dimensions';
import { customSchema } from '../../src/config/schema/elements/stock/custom';
import { conditionalSchema } from '../../src/config/schema/elements/types';
import { createConfig } from '../test-utils';

// @vitest-environment jsdom
describe('config defaults', () => {
  it('should be as expected', () => {
    expect(createConfig()).toEqual({
      cameras: [{}],
      cameras_global: {
        always_error_if_entity_unavailable: false,
        dependencies: {
          all_cameras: false,
          cameras: [],
        },
        engine: 'auto',
        frigate: {
          client_id: 'frigate',
        },
        image: {
          mode: 'auto',
          refresh_seconds: 1,
        },
        live_provider: 'auto',
        motioneye: {
          images: {
            directory_pattern: '%Y-%m-%d',
            file_pattern: '%H-%M-%S',
          },
          movies: {
            directory_pattern: '%Y-%m-%d',
            file_pattern: '%H-%M-%S',
          },
        },
        proxy: {
          dynamic: true,
          media: 'auto',
          ssl_verification: 'auto',
          ssl_ciphers: 'auto',
        },
        ptz: {
          c2r_delay_between_calls_seconds: 0.2,
          r2c_delay_between_calls_seconds: 0.5,
        },
        reolink: {
          media_resolution: 'low',
        },
        triggers: {
          events: ['events', 'clips', 'snapshots'],
          entities: [],
          motion: false,
          occupancy: false,
        },
      },
      debug: {
        logging: false,
      },
      dimensions: {
        aspect_ratio: [16, 9],
        aspect_ratio_mode: 'dynamic',
        height: 'auto',
      },
      image: {
        zoomable: true,
        mode: 'auto',
        refresh_seconds: 1,
      },
      live: {
        auto_mute: ['unselected', 'hidden', 'microphone'],
        auto_pause: [],
        auto_play: ['selected', 'visible'],
        auto_unmute: ['microphone'],
        controls: {
          builtin: true,
          next_previous: {
            size: 48,
            style: 'chevrons',
          },
          ptz: {
            hide_home: false,
            hide_pan_tilt: false,
            hide_zoom: false,
            mode: 'auto',
            orientation: 'horizontal',
            position: 'bottom-right',
          },
          thumbnails: {
            media_type: 'events',
            events_media_type: 'all',
            mode: 'right',
            show_details: true,
            show_download_control: true,
            show_favorite_control: true,
            show_timeline_control: true,
            size: 100,
          },
          timeline: {
            clustering_threshold: 3,
            events_media_type: 'all',
            format: {
              '24h': true,
            },
            mode: 'none',
            pan_mode: 'pan',
            show_recordings: true,
            style: 'ribbon',
            window_seconds: 3600,
          },
        },
        draggable: true,
        lazy_load: true,
        lazy_unload: [],
        microphone: {
          always_connected: false,
          disconnect_seconds: 90,
          mute_after_microphone_mute_seconds: 60,
        },
        preload: false,
        show_image_during_load: true,
        transition_effect: 'slide',
        zoomable: true,
      },
      media_gallery: {
        controls: {
          filter: {
            mode: 'right',
          },
          thumbnails: {
            mode: 'right',
            show_details: false,
            show_download_control: true,
            show_favorite_control: true,
            show_timeline_control: true,
            size: 100,
          },
        },
      },
      media_viewer: {
        auto_mute: ['unselected', 'hidden'],
        auto_pause: ['unselected', 'hidden'],
        auto_play: ['selected', 'visible'],
        auto_unmute: [],
        controls: {
          builtin: true,
          next_previous: {
            size: 48,
            style: 'thumbnails',
          },
          ptz: {
            hide_home: false,
            hide_pan_tilt: false,
            hide_zoom: false,
            mode: 'off',
            orientation: 'horizontal',
            position: 'bottom-right',
          },
          thumbnails: {
            mode: 'right',
            show_details: true,
            show_download_control: true,
            show_favorite_control: true,
            show_timeline_control: true,
            size: 100,
          },
          timeline: {
            clustering_threshold: 3,
            events_media_type: 'all',
            format: {
              '24h': true,
            },
            mode: 'none',
            pan_mode: 'pan',
            show_recordings: true,
            style: 'ribbon',
            window_seconds: 3600,
          },
        },
        draggable: true,
        lazy_load: true,
        snapshot_click_plays_clip: true,
        transition_effect: 'slide',
        zoomable: true,
      },
      menu: {
        alignment: 'left',
        button_size: 40,
        buttons: {
          camera_ui: {
            enabled: true,
            priority: 50,
          },
          cameras: {
            enabled: true,
            priority: 50,
          },
          clips: {
            enabled: true,
            priority: 50,
          },
          display_mode: {
            enabled: true,
            priority: 50,
          },
          download: {
            enabled: true,
            priority: 50,
          },
          expand: {
            enabled: false,
            priority: 50,
          },
          fullscreen: {
            enabled: true,
            priority: 50,
          },
          image: {
            enabled: false,
            priority: 50,
          },
          iris: {
            enabled: true,
            priority: 50,
          },
          live: {
            enabled: true,
            priority: 50,
          },
          media_player: {
            enabled: true,
            priority: 50,
          },
          microphone: {
            enabled: false,
            priority: 50,
            type: 'momentary',
          },
          mute: {
            enabled: false,
            priority: 50,
          },
          play: {
            enabled: false,
            priority: 50,
          },
          ptz_controls: {
            enabled: false,
            priority: 50,
          },
          ptz_home: {
            enabled: false,
            priority: 50,
          },
          recordings: {
            enabled: false,
            priority: 50,
          },
          screenshot: {
            enabled: false,
            priority: 50,
          },
          snapshots: {
            enabled: true,
            priority: 50,
          },
          substreams: {
            enabled: true,
            priority: 50,
          },
          timeline: {
            enabled: true,
            priority: 50,
          },
        },
        position: 'top',
        style: 'hidden',
      },
      performance: {
        features: {
          animated_progress_indicator: true,
          card_loading_indicator: true,
          media_chunk_size: 50,
        },
        style: {
          border_radius: true,
          box_shadow: true,
        },
      },
      status_bar: {
        height: 40,
        items: {
          engine: {
            enabled: true,
            priority: 50,
          },
          resolution: {
            enabled: true,
            priority: 50,
          },
          technology: {
            enabled: true,
            priority: 50,
          },
          title: {
            enabled: true,
            priority: 50,
          },
        },
        popup_seconds: 3,
        position: 'bottom',
        style: 'popup',
      },
      timeline: {
        clustering_threshold: 3,
        controls: {
          thumbnails: {
            mode: 'right',
            show_details: true,
            show_download_control: true,
            show_favorite_control: true,
            show_timeline_control: true,
            size: 100,
          },
        },
        events_media_type: 'all',
        format: {
          '24h': true,
        },
        pan_mode: 'pan',
        show_recordings: true,
        style: 'stack',
        window_seconds: 3600,
      },
      type: 'advanced-camera-card',
      view: {
        camera_select: 'current',
        default: 'live',
        keyboard_shortcuts: {
          enabled: true,
          ptz_down: {
            key: 'ArrowDown',
          },
          ptz_home: {
            key: 'h',
          },
          ptz_left: {
            key: 'ArrowLeft',
          },
          ptz_right: {
            key: 'ArrowRight',
          },
          ptz_up: {
            key: 'ArrowUp',
          },
          ptz_zoom_in: {
            key: '+',
          },
          ptz_zoom_out: {
            key: '-',
          },
        },
        theme: {
          themes: ['traditional'],
        },
        triggers: {
          show_trigger_status: false,
          untrigger_seconds: 0,
          actions: {
            trigger: 'update',
            untrigger: 'none',
            interaction_mode: 'inactive',
          },
          filter_selected_camera: true,
        },
        interaction_seconds: 300,
        dim: false,
        default_cycle_camera: false,
        default_reset: {
          after_interaction: false,
          every_seconds: 0,
          entities: [],
          interaction_mode: 'inactive',
        },
      },
    });
  });

  it('should include all stock elements', () => {
    const stockElements = [
      {
        type: 'icon',
        icon: 'mdi:dog',
        entity: 'camera.office',
      },
      {
        type: 'custom:element',
        data: 'foo',
      },
      {
        type: 'image',
        entity: 'camera.office',
        image: 'image',
        camera_image: 'camera_image',
        camera_view: 'camera_view',
        state_image: {},
        filter: 'filter',
        state_filter: { on: '/foo' },
        aspect_ratio: '16 / 9',
      },
      {
        type: 'custom:advanced-camera-card-menu-icon',
        icon: 'mdi:cat',
        entity: 'camera.kitchen',
      },
      {
        type: 'custom:advanced-camera-card-menu-state-icon',
        entity: 'camera.kitchen',
        icon: 'mdi:sheep',
        state_color: false,
      },
      {
        type: 'state-badge',
        entity: 'sensor.kitchen_dining_multisensor_air_temperature',
        style: {
          left: '100px',
          top: '50px',
        },
        title: 'Temperature',
      },
      {
        type: 'state-icon',
        entity: 'light.office_main_lights',
        icon: 'mdi:lamp',
        state_color: true,
        style: {
          left: '100px',
          top: '100px',
        },
      },
      {
        type: 'state-label',
        entity: 'sensor.kitchen_motion_sensor_battery',
        attribute: 'battery_voltage',
        prefix: 'Volts',
        title: 'Battery Voltage',
        style: {
          left: '100px',
          top: '150px',
        },
      },
      {
        type: 'state-label',
        entity: 'sensor.kitchen_motion_sensor_battery',
        attribute: 'battery_voltage',
        prefix: 'Volts: ',
        title: 'Battery Voltage',
        style: {
          backgroundColor: 'black',
          left: '100px',
          top: '200px',
        },
      },
      {
        type: 'service-button',
        title: 'Light on',
        service: 'homeassistant.turn_on',
        service_data: {
          entity: 'light.office_main_lights',
        },
        style: {
          left: '100px',
          top: '250px',
        },
      },
      {
        type: 'icon',
        icon: 'mdi:cow',
        title: 'Moo',
        style: {
          left: '100px',
          top: '300px',
        },
      },
      {
        type: 'image',
        entity: 'light.office_main_lights',
        title: 'Image',
        state_image: {
          on: 'https://picsum.photos/id/1003/1181/1772',
          off: 'https://picsum.photos/id/102/4320/3240',
        },
        state_filter: {
          on: 'brightness(110%) saturate(1.2)',
          off: 'brightness(50%) hue-rotate(45deg)',
        },
        style: {
          left: '100px',
          top: '350px',
          height: '50px',
          width: '100px',
        },
      },
      {
        type: 'conditional',
        conditions: [
          {
            condition: 'state',
            entity: 'light.office_main_lights',
            state: 'on',
            state_not: 'off',
          },
        ],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:dog',
            title: 'Woof',
            style: {
              left: '100px',
              top: '400px',
            },
          },
        ],
      },
    ];

    expect(
      createConfig({
        elements: stockElements,
      }).elements,
    ).toEqual(stockElements);
  });

  it('should include all custom elements', () => {
    const customElements = [
      {
        type: 'custom:advanced-camera-card-menu-icon',
        alignment: 'matching',
        enabled: true,
        entity: 'light.office_main_lights',
        icon: 'mdi:car',
        permanent: false,
        priority: 50,
        style: {
          color: 'white',
        },
        title: 'Vroom',
      },
      {
        type: 'custom:advanced-camera-card-menu-state-icon',
        alignment: 'matching',
        enabled: true,
        entity: 'light.office_main_lights',
        icon: 'mdi:chair-rolling',
        permanent: false,
        priority: 50,
        state_color: true,
        style: {
          color: 'white',
        },
        title: 'Office lights',
      },
      {
        type: 'custom:advanced-camera-card-menu-submenu',
        alignment: 'matching',
        enabled: true,
        entity: 'light.office_main_lights',
        icon: 'mdi:menu',
        items: [
          {
            enabled: true,
            entity: 'light.office_main_lights',
            icon: 'mdi:lightbulb',
            selected: false,
            state_color: true,
            style: {
              color: 'white',
            },
            tap_action: {
              action: 'toggle',
            },
            title: 'Lights',
          },
          {
            enabled: true,
            icon: 'mdi:google',
            selected: false,
            state_color: false,
            style: {
              color: 'white',
            },
            tap_action: {
              action: 'url',
              url_path: 'https://www.google.com',
            },
            title: 'Google',
          },
        ],
        permanent: false,
        priority: 50,
        style: {
          color: 'white',
        },
        title: 'Office lights',
      },
      {
        type: 'custom:advanced-camera-card-menu-submenu-select',
        alignment: 'matching',
        enabled: true,
        entity: 'input_select.kitchen_scene',
        icon: 'mdi:lamps',
        options: {
          'scene.kitchen_cooking_scene': {
            enabled: true,
            icon: 'mdi:chef-hat',
            selected: false,
            state_color: true,
            style: {
              color: 'white',
            },
            title: 'Cooking time!',
          },
          'scene.kitchen_tv_scene': {
            icon: 'mdi:television',
            title: 'TV!',
          },
        },
        permanent: false,
        priority: 50,
        state_color: true,
        style: {
          color: 'white',
        },
        title: 'Kitchen Scene',
      },
      {
        type: 'custom:advanced-camera-card-conditional',
        elements: [
          {
            type: 'icon',
            icon: 'mdi:pig',
            title: 'Oink',
            style: {
              left: '300px',
              top: '100px',
            },
          },
        ],
        conditions: [
          {
            condition: 'view',
            views: ['live'],
          },
        ],
      },
      {
        type: 'custom:advanced-camera-card-status-bar-string',
        enabled: true,
        exclusive: false,
        expand: false,
        string: 'Intruder alert!',
        priority: 50,
        sufficient: false,
      },
      {
        type: 'custom:advanced-camera-card-status-bar-icon',
        enabled: true,
        exclusive: false,
        expand: false,
        icon: 'mdi:cow',
        priority: 50,
        sufficient: false,
      },
      {
        type: 'custom:advanced-camera-card-status-bar-image',
        enabled: true,
        exclusive: false,
        expand: false,
        image: 'https://my.site.com/status.png',
        priority: 50,
        sufficient: false,
      },
    ];

    expect(
      createConfig({
        elements: customElements,
      }).elements,
    ).toEqual(customElements);
  });

  it('should include all conditions', () => {
    const conditions = [
      { condition: 'camera', cameras: ['camera.office'] },
      { condition: 'config', paths: ['menu.style'] },
      { condition: 'display_mode', display_mode: 'single' },
      { condition: 'expand', expand: true },
      { condition: 'fullscreen', fullscreen: true },
      { condition: 'initialized' },
      { condition: 'interaction', interaction: true },
      {
        condition: 'key',
        alt: false,
        ctrl: false,
        key: 'F',
        meta: false,
        shift: false,
        state: 'down',
      },
      { condition: 'media_loaded', media_loaded: true },
      { condition: 'microphone', connected: true, muted: true },
      {
        condition: 'numeric_state',
        entity: 'sensor.office_temperature',
        above: 10,
        below: 20,
      },
      { condition: 'screen', media_query: '(orientation: landscape)' },
      {
        condition: 'state',
        entity: 'climate.office',
        state: 'heat',
        state_not: 'off',
      },
      { condition: 'triggered', triggered: ['camera.office'] },
      { condition: 'user', users: ['581fca7fdc014b8b894519cc531f9a04'] },
      {
        condition: 'user_agent',
        user_agent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        user_agent_re: 'Chrome/',
        companion: true,
      },
      { condition: 'view', views: ['live'] },
    ];

    const elements = [
      {
        type: 'custom:advanced-camera-card-conditional',
        elements: [
          {
            type: 'icon',
            icon: 'mdi:pig',
          },
        ],
        conditions: conditions,
      },
    ];

    expect(
      createConfig({
        elements: elements,
      }).elements,
    ).toEqual(elements);
  });

  it('should include all stock actions', () => {
    const stockActions = [
      {
        action: 'more-info',
      },
      {
        action: 'toggle',
      },
      {
        action: 'call-service',
        service: 'homeassistant.toggle',
        data: {
          entity_id: 'light.office_main_lights',
        },
      },
      {
        action: 'navigate',
        navigation_path: '/lovelace/2',
      },
      {
        action: 'url',
        url_path: 'https://www.home-assistant.io/',
      },
      {
        action: 'none',
      },
      {
        action: 'fire-dom-event',
        key: 'value',
      },
      {
        action: 'perform-action',
        perform_action: 'homeassistant.toggle',
        target: {
          entity_id: 'light.office_main_lights',
        },
      },
    ];

    expect(
      createConfig({
        live: {
          actions: {
            tap_action: stockActions,
          },
        },
      }).live.actions?.tap_action,
    ).toEqual(stockActions);
  });

  it('should include all custom actions', () => {
    const customActions = [
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'camera_select',
        camera: 'camera.front_door',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'camera_ui',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'clip',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'clips',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'default',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'diagnostics',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'display_mode_select',
        display_mode: 'grid',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'download',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'expand',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'fullscreen',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'image',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'live',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'live_substream_off',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'live_substream_on',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'live_substream_select',
        camera: 'camera.front_door_hd',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'log',
        message: 'Hello, world!',
        level: 'debug',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'media_player',
        media_player: 'media_player.nesthub50be',
        media_player_action: 'play',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'media_player',
        media_player: 'media_player.nesthub',
        media_player_action: 'stop',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'menu_toggle',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'microphone_connect',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'microphone_disconnect',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'microphone_mute',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'microphone_unmute',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'mute',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'pause',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'play',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'ptz',
        ptz_action: 'preset',
        ptz_preset: 'doorway',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'ptz_controls',
        enabled: true,
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'ptz_digital',
        absolute: {
          zoom: 5,
          pan: {
            x: 58,
            y: 14,
          },
        },
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'ptz_multi',
        ptz_action: 'left',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'recording',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'recordings',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'screenshot',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'sleep',
        duration: {
          h: 1,
          m: 20,
          s: 56,
          ms: 422,
        },
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'snapshot',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'snapshots',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'timeline',
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'unmute',
      },

      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'status_bar',
        status_bar_action: 'add',
        items: [
          {
            type: 'custom:advanced-camera-card-status-bar-string',
            enabled: true,
            exclusive: false,
            expand: false,
            string: 'Intruder alert!',
            priority: 50,
            sufficient: false,
          },
          {
            type: 'custom:advanced-camera-card-status-bar-icon',
            enabled: true,
            exclusive: false,
            expand: false,
            icon: 'mdi:cow',
            priority: 50,
            sufficient: false,
          },
          {
            type: 'custom:advanced-camera-card-status-bar-image',
            enabled: true,
            exclusive: false,
            expand: false,
            image: 'https://my.site.com/status.png',
            priority: 50,
            sufficient: false,
          },
        ],
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'status_bar',
        status_bar_action: 'remove',
        items: [
          {
            type: 'custom:advanced-camera-card-status-bar-string',
            enabled: true,
            exclusive: false,
            expand: false,
            string: 'Intruder alert!',
            priority: 50,
            sufficient: false,
          },
          {
            type: 'custom:advanced-camera-card-status-bar-icon',
            enabled: true,
            exclusive: false,
            expand: false,
            icon: 'mdi:cow',
            priority: 50,
            sufficient: false,
          },
          {
            type: 'custom:advanced-camera-card-status-bar-image',
            enabled: true,
            exclusive: false,
            expand: false,
            image: 'https://my.site.com/status.png',
            priority: 50,
            sufficient: false,
          },
        ],
      },
      {
        action: 'custom:advanced-camera-card-action',
        advanced_camera_card_action: 'status_bar',
        status_bar_action: 'reset',
      },
    ];

    expect(
      createConfig({
        live: {
          actions: {
            tap_action: customActions,
          },
        },
      }).live.actions?.tap_action,
    ).toEqual(
      // Action type will be transformed to fire-dom-event.
      customActions.map((action) => ({ ...action, action: 'fire-dom-event' })),
    );
  });
});

it('should transform dimensions.aspect_ratio', () => {
  expect(
    dimensionsConfigSchema.parse({
      aspect_ratio: '16 / 9',
    }),
  ).toEqual(expect.objectContaining({ aspect_ratio: [16, 9] }));

  expect(
    dimensionsConfigSchema.parse({
      aspect_ratio: '16 : 9',
    }),
  ).toEqual(expect.objectContaining({ aspect_ratio: [16, 9] }));

  expect(
    dimensionsConfigSchema.parse({
      aspect_ratio: [16, 9],
    }),
  ).toEqual(expect.objectContaining({ aspect_ratio: [16, 9] }));
});

describe('should refine user_agent_re conditions', () => {
  it('should successfully parse valid user_agent_re condition', () => {
    expect(
      advancedCameraCardConditionSchema.parse({
        condition: 'user_agent',
        user_agent_re: 'Chrome/',
      }),
    ).toEqual({
      condition: 'user_agent',
      user_agent_re: 'Chrome/',
    });
  });

  it('should reject invalid user_agent_re conditions', () => {
    expect(() =>
      advancedCameraCardConditionSchema.parse({
        condition: 'user_agent',
        user_agent_re: '[',
      }),
    ).toThrowError(/Invalid regular expression/);
  });
});

it('should transform action', () => {
  expect(
    advancedCameraCardCustomActionsBaseSchema.parse({
      action: 'custom:advanced-camera-card-action',
    }),
  ).toEqual({
    action: 'fire-dom-event',
  });
});

describe('should convert webrtc card PTZ to Advanced Camera Card PTZ', () => {
  describe('relative actions', () => {
    it.each([
      ['left' as const],
      ['right' as const],
      ['up' as const],
      ['down' as const],
      ['zoom_in' as const],
      ['zoom_out' as const],
    ])('%s', (action: string) => {
      expect(
        cameraConfigSchema.parse({
          ptz: {
            service: 'foo',
            [`data_${action}`]: {
              device: '048123',
              cmd: action,
            },
          },
        }),
      ).toEqual(
        expect.objectContaining({
          ptz: expect.objectContaining({
            [`actions_${action}`]: {
              action: 'perform-action',
              perform_action: 'foo',
              data: {
                device: '048123',
                cmd: action,
              },
            },
          }),
        }),
      );
    });
  });

  describe('continuous actions', () => {
    it.each([
      ['left' as const],
      ['right' as const],
      ['up' as const],
      ['down' as const],
      ['zoom_in' as const],
      ['zoom_out' as const],
    ])('%s', (action: string) => {
      expect(
        cameraConfigSchema.parse({
          ptz: {
            service: 'foo',
            [`data_${action}_start`]: {
              device: '048123',
              cmd: action,
              phase: 'start',
            },
            [`data_${action}_stop`]: {
              device: '048123',
              cmd: action,
              phase: 'stop',
            },
          },
        }),
      ).toEqual(
        expect.objectContaining({
          ptz: expect.objectContaining({
            [`actions_${action}_start`]: {
              action: 'perform-action',
              perform_action: 'foo',
              data: {
                device: '048123',
                cmd: action,
                phase: 'start',
              },
            },
            [`actions_${action}_stop`]: {
              action: 'perform-action',
              perform_action: 'foo',
              data: {
                device: '048123',
                cmd: action,
                phase: 'stop',
              },
            },
          }),
        }),
      );
    });
  });

  it('presets', () => {
    expect(
      cameraConfigSchema.parse({
        ptz: {
          service: 'service_outer',
          presets: {
            service: 'service_inner',
            data_home: {
              device: '048123',
              cmd: 'home',
            },
            data_another: {
              device: '048123',
              cmd: 'another',
            },
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        ptz: expect.objectContaining({
          presets: {
            home: {
              action: 'perform-action',
              perform_action: 'service_inner',
              data: {
                device: '048123',
                cmd: 'home',
              },
            },
            another: {
              action: 'perform-action',
              perform_action: 'service_inner',
              data: {
                device: '048123',
                cmd: 'another',
              },
            },
          },
        }),
      }),
    );
  });
});

describe('should lazy evaluate schemas', () => {
  it('conditional picture element', () => {
    expect(
      conditionalSchema.parse({
        type: 'conditional',
        conditions: [
          {
            condition: 'state',
            entity: 'light.office_main_lights',
            state: 'on',
            state_not: 'off',
          },
        ],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:dog',
            title: 'Woof',
            style: {
              left: '100px',
              top: '400px',
            },
          },
        ],
      }),
    ).toEqual({
      conditions: [
        {
          condition: 'state',
          entity: 'light.office_main_lights',
          state: 'on',
          state_not: 'off',
        },
      ],
      elements: [
        {
          icon: 'mdi:dog',
          style: {
            left: '100px',
            top: '400px',
          },
          title: 'Woof',
          type: 'icon',
        },
      ],
      type: 'conditional',
    });
  });

  it('status bar actions', () => {
    const input = {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'status_bar',
      status_bar_action: 'reset',
      items: [
        {
          type: 'custom:advanced-camera-card-status-bar-string',
          string: 'Item',
        },
      ],
    };
    expect(statusBarActionConfigSchema.parse(input)).toEqual(input);
  });
});

describe('should handle custom advanced camera card elements', () => {
  it('should add custom error on advanced camera card element', () => {
    const result = customSchema.safeParse({
      type: 'custom:advanced-camera-card-foo',
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.error.errors[0]).toEqual({
        code: 'custom',
        message: 'advanced-camera-card custom elements must match specific schemas',
        fatal: true,
        path: ['type'],
      });
    }
  });

  it('should not add custom error on valid entry', () => {
    const result = customSchema.safeParse({
      type: 'custom:foo',
    });
    expect(result.success).toBeTruthy();
  });
});

// https://github.com/dermotduffy/advanced-camera-card/issues/1280
it('should not require title controls to specify all options', () => {
  expect(
    createConfig({
      cameras: [{}],
      live: {
        controls: {
          title: {
            mode: 'popup-top-left',
          },
        },
      },
    }),
  ).toBeTruthy();
});

it('should strip trailing slashes from go2rtc url', () => {
  const config = createConfig({
    cameras: [
      {
        go2rtc: {
          url: 'https://my-custom-go2rtc//',
        },
      },
    ],
  });
  expect(config).toBeTruthy();
  expect(config.cameras[0].go2rtc.url).toBe('https://my-custom-go2rtc');
});

it('media viewer should not support microphone based conditions', () => {
  expect(() =>
    createConfig({
      cameras: [],
      media_viewer: {
        auto_unmute: 'microphone' as const,
      },
    }),
  ).toThrowError();
});

describe('automations should require at least one action', () => {
  it('no action', () => {
    expect(() =>
      createConfig({
        cameras: [{}],
        automations: [{ conditions: [] }],
      }),
    ).toThrowError(/Automations must include at least one action/);
  });

  it('empty actions', () => {
    expect(() =>
      createConfig({
        cameras: [{}],
        automations: [{ conditions: [], actions: [], actions_not: [] }],
      }),
    ).toThrowError(/Automations must include at least one action/);
  });

  it('at least one action', () => {
    expect(() =>
      createConfig({
        cameras: [{}],
        automations: [
          {
            conditions: [],
            actions: [
              {
                action: 'fire-dom-event',
              },
            ],
          },
        ],
      }),
    ).not.toThrowError();
  });
});
