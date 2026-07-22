import type {
  HAFormExpandableSchema,
  HAFormSchema,
  HASelectSelectorOption,
} from '../../../ha/types';
import { localize } from '../../../localize/localize';
import { capabilityKeys } from '../../../types';
import { createGrid } from './common/grid';
import { getImageFieldsSchema } from './common/image';
import { getProxySchema } from './common/proxy';
import { createNumberSelector, createSelectSelector } from './common/selectors';

const percentageSelector = createNumberSelector({ min: 0, max: 100 });

const getMediaLayoutSchema = (): HAFormExpandableSchema => ({
  name: 'layout',
  type: 'expandable',
  title: localize('config.cameras.dimensions.layout.editor_label'),
  icon: 'mdi:page-layout-body',
  schema: [
    {
      name: 'fit',
      selector: createSelectSelector([
        {
          value: 'contain',
          label: localize('config.cameras.dimensions.layout.fits.contain'),
        },
        {
          value: 'cover',
          label: localize('config.cameras.dimensions.layout.fits.cover'),
        },
        {
          value: 'fill',
          label: localize('config.cameras.dimensions.layout.fits.fill'),
        },
      ]),
    },
    {
      name: 'position',
      type: 'expandable',
      title: localize('config.cameras.dimensions.layout.position.editor_label'),
      schema: [
        createGrid([
          { name: 'x', selector: percentageSelector },
          { name: 'y', selector: percentageSelector },
        ]),
      ],
    },
    {
      name: 'view_box',
      type: 'expandable',
      title: localize('config.cameras.dimensions.layout.view_box.editor_label'),
      schema: [
        createGrid([
          { name: 'top', selector: percentageSelector },
          { name: 'bottom', selector: percentageSelector },
          { name: 'left', selector: percentageSelector },
          { name: 'right', selector: percentageSelector },
        ]),
      ],
    },
    {
      name: 'pan',
      type: 'expandable',
      title: localize('config.cameras.dimensions.layout.pan.editor_label'),
      schema: [
        createGrid([
          { name: 'x', selector: percentageSelector },
          { name: 'y', selector: percentageSelector },
        ]),
      ],
    },
    {
      name: 'zoom',
      selector: createNumberSelector({ min: 1, max: 10 }),
    },
  ],
});

/**
 * Get the camera fields the simple editor shows: the entity, how it is
 * streamed, and how it is presented.
 * @returns The camera fields.
 */
export const getCameraSimpleFields = (): HAFormSchema[] => [
  { name: 'camera_entity', selector: { entity: { domain: 'camera' } } },
  {
    name: 'live_provider',
    selector: createSelectSelector([
      { value: 'auto', label: localize('config.cameras.live_providers.auto') },
      { value: 'ha', label: localize('config.cameras.live_providers.ha') },
      { value: 'image', label: localize('config.cameras.live_providers.image') },
      { value: 'jsmpeg', label: localize('config.cameras.live_providers.jsmpeg') },
      { value: 'go2rtc', label: localize('config.cameras.live_providers.go2rtc') },
      {
        value: 'go2rtc-experimental',
        label: localize('config.cameras.live_providers.go2rtc-experimental'),
      },
      {
        value: 'webrtc-card',
        label: localize('config.cameras.live_providers.webrtc-card'),
      },
    ]),
  },
  createGrid([
    { name: 'title', selector: { text: {} } },
    { name: 'icon', selector: { icon: {} } },
  ]),
];

interface CameraSchemaOptions {
  otherCameras: HASelectSelectorOption[];
  folders: HASelectSelectorOption[];
}

/**
 * Get the schema for a single camera (everything except the triggers group,
 * which is rendered by a hand-built panel so it can host the events array
 * list).
 * @param options The camera and folder lists the dropdowns choose from.
 * @returns The camera form schema.
 */
export const getCameraSchema = (options: CameraSchemaOptions): HAFormSchema[] => {
  const capabilityOptions: HASelectSelectorOption[] = capabilityKeys.map((key) => ({
    value: key,
    label: localize(`config.cameras.capabilities.capabilities.${key}`),
  }));

  return [
    ...getCameraSimpleFields(),
    { name: 'id', selector: { text: {} } },
    { name: 'always_error_if_entity_unavailable', selector: { boolean: {} } },

    {
      name: 'capabilities',
      type: 'expandable',
      title: localize('config.cameras.capabilities.editor_label'),
      icon: 'mdi:cog-stop',
      schema: [
        {
          name: 'disable',
          selector: createSelectSelector(capabilityOptions, { multiple: true }),
        },
        {
          name: 'disable_except',
          selector: createSelectSelector(capabilityOptions, { multiple: true }),
        },
        {
          name: 'force',
          selector: createSelectSelector(
            [
              {
                value: '2-way-audio',
                label: localize('config.cameras.capabilities.capabilities.2-way-audio'),
              },
            ],
            { multiple: true },
          ),
        },
      ],
    },
    {
      name: 'cast',
      type: 'expandable',
      title: localize('config.cameras.cast.editor_label'),
      icon: 'mdi:cast',
      schema: [
        {
          name: 'method',
          selector: createSelectSelector([
            {
              value: 'standard',
              label: localize('config.cameras.cast.methods.standard'),
            },
            {
              value: 'dashboard',
              label: localize('config.cameras.cast.methods.dashboard'),
            },
          ]),
        },
        {
          name: 'dashboard',
          type: 'expandable',
          title: localize('config.cameras.cast.dashboard.editor_label'),
          schema: [
            createGrid([
              { name: 'dashboard_path', selector: { text: {} } },
              { name: 'view_path', selector: { text: {} } },
            ]),
          ],
        },
      ],
    },
    {
      name: 'dependencies',
      type: 'expandable',
      title: localize('config.cameras.dependencies.editor_label'),
      icon: 'mdi:graph',
      schema: [
        { name: 'all_cameras', selector: { boolean: {} } },
        {
          name: 'cameras',
          selector: createSelectSelector(options.otherCameras, { multiple: true }),
        },
      ],
    },
    {
      name: 'dimensions',
      type: 'expandable',
      title: localize('config.cameras.dimensions.editor_label'),
      icon: 'mdi:aspect-ratio',
      schema: [
        createGrid([
          { name: 'aspect_ratio', selector: { text: {} } },
          {
            name: 'rotation',
            selector: createSelectSelector([
              { value: 0, label: localize('config.cameras.dimensions.rotations.0') },
              { value: 90, label: localize('config.cameras.dimensions.rotations.90') },
              {
                value: 180,
                label: localize('config.cameras.dimensions.rotations.180'),
              },
              {
                value: 270,
                label: localize('config.cameras.dimensions.rotations.270'),
              },
            ]),
          },
        ]),
        getMediaLayoutSchema(),
      ],
    },
    {
      // Nameless: a visual grouping only:
      // `engine`/`frigate`/`motioneye`/`reolink` are direct camera keys, not
      // nested under an `engine` object.
      type: 'expandable',
      title: localize('config.cameras.engines.editor_label'),
      icon: 'mdi:engine',
      docPath: ['cameras', 'engine'],
      schema: [
        {
          name: 'engine',
          label: localize('config.cameras.engine'),
          selector: createSelectSelector([
            { value: 'auto', label: localize('config.cameras.engines.auto') },
            { value: 'frigate', label: localize('config.cameras.engines.frigate') },
            { value: 'generic', label: localize('config.cameras.engines.generic') },
            { value: 'motioneye', label: localize('config.cameras.engines.motioneye') },
            { value: 'reolink', label: localize('config.cameras.engines.reolink') },
            { value: 'tplink', label: localize('config.cameras.engines.tplink') },
          ]),
        },
        {
          name: 'frigate',
          type: 'expandable',
          title: localize('config.cameras.frigate.editor_label'),
          icon: 'advanced-camera-card:frigate',
          schema: [
            { name: 'camera_name', selector: { text: {} } },
            { name: 'url', selector: { text: {} } },
            { name: 'labels', selector: createSelectSelector([], { multiple: true }) },
            { name: 'zones', selector: createSelectSelector([], { multiple: true }) },
            { name: 'client_id', selector: { text: {} } },
          ],
        },
        {
          name: 'motioneye',
          type: 'expandable',
          title: localize('config.cameras.motioneye.editor_label'),
          icon: 'advanced-camera-card:motioneye',
          schema: [
            { name: 'url', selector: { text: {} } },
            {
              name: 'images',
              type: 'expandable',
              title: localize('config.cameras.motioneye.images.editor_label'),
              schema: [
                createGrid([
                  { name: 'directory_pattern', selector: { text: {} } },
                  { name: 'file_pattern', selector: { text: {} } },
                ]),
              ],
            },
            {
              name: 'movies',
              type: 'expandable',
              title: localize('config.cameras.motioneye.movies.editor_label'),
              schema: [
                createGrid([
                  { name: 'directory_pattern', selector: { text: {} } },
                  { name: 'file_pattern', selector: { text: {} } },
                ]),
              ],
            },
          ],
        },
        {
          name: 'reolink',
          type: 'expandable',
          title: localize('config.cameras.reolink.editor_label'),
          icon: 'advanced-camera-card:reolink',
          schema: [
            { name: 'url', selector: { text: {} } },
            {
              name: 'media_resolution',
              label: localize('config.cameras.reolink.media_resolution.editor_label'),
              selector: createSelectSelector([
                {
                  value: 'high',
                  label: localize('config.cameras.reolink.media_resolution.high'),
                },
                {
                  value: 'low',
                  label: localize('config.cameras.reolink.media_resolution.low'),
                },
              ]),
            },
          ],
        },
      ],
    },
    {
      // Nameless: a visual grouping only: `go2rtc`/`image`/`webrtc_card` are
      // direct camera keys.
      type: 'expandable',
      title: localize('config.cameras.live_provider_options.editor_label'),
      icon: 'mdi:cctv',
      docPath: ['cameras', 'live_provider'],
      schema: [
        {
          name: 'go2rtc',
          type: 'expandable',
          title: localize('config.cameras.go2rtc.editor_label'),
          icon: 'mdi:eye',
          schema: [
            {
              name: 'modes',
              label: localize('config.cameras.go2rtc.modes.editor_label'),
              selector: createSelectSelector(
                [
                  {
                    value: 'webrtc',
                    label: localize('config.cameras.go2rtc.modes.webrtc'),
                  },
                  { value: 'mse', label: localize('config.cameras.go2rtc.modes.mse') },
                  { value: 'mp4', label: localize('config.cameras.go2rtc.modes.mp4') },
                  {
                    value: 'mjpeg',
                    label: localize('config.cameras.go2rtc.modes.mjpeg'),
                  },
                ],
                { multiple: true },
              ),
            },
            createGrid([
              { name: 'stream', selector: { text: {} } },
              { name: 'url', selector: { text: {} } },
            ]),
            { name: 'metadata_fetch_timeout_seconds', selector: createNumberSelector() },
          ],
        },
        {
          name: 'image',
          type: 'expandable',
          title: localize('config.cameras.image.editor_label'),
          icon: 'mdi:image',
          schema: getImageFieldsSchema(),
        },
        {
          name: 'webrtc_card',
          type: 'expandable',
          title: localize('config.cameras.webrtc_card.editor_label'),
          icon: 'mdi:webrtc',
          schema: [
            { name: 'entity', selector: { entity: { domain: 'camera' } } },
            { name: 'url', selector: { text: {} } },
          ],
        },
      ],
    },
    {
      name: 'media',
      type: 'expandable',
      title: localize('config.cameras.media.editor_label'),
      icon: 'mdi:play-box-outline',
      schema: [
        createGrid([
          {
            name: 'type',
            selector: createSelectSelector([
              { value: 'auto', label: localize('config.common.media_types.auto') },
              {
                value: 'reviews',
                label: localize('config.common.media_types.reviews'),
              },
              { value: 'events', label: localize('config.common.media_types.events') },
              {
                value: 'recordings',
                label: localize('config.common.media_types.recordings'),
              },
              { value: 'folder', label: localize('config.common.media_types.folder') },
            ]),
          },
          {
            name: 'events_type',
            selector: createSelectSelector([
              { value: 'all', label: localize('config.common.events_media_types.all') },
              {
                value: 'clips',
                label: localize('config.common.events_media_types.clips'),
              },
              {
                value: 'snapshots',
                label: localize('config.common.events_media_types.snapshots'),
              },
            ]),
          },
        ]),
        {
          name: 'reviewed',
          selector: createSelectSelector([
            {
              value: 'unreviewed',
              label: localize('config.cameras.media.revieweds.unreviewed'),
            },
            {
              value: 'reviewed',
              label: localize('config.cameras.media.revieweds.reviewed'),
            },
            { value: 'all', label: localize('config.cameras.media.revieweds.all') },
          ]),
        },
        {
          name: 'folders',
          selector: createSelectSelector(options.folders, { multiple: true }),
        },
      ],
    },
    getProxySchema({
      title: localize('config.cameras.proxy.editor_label'),
      includeLive: true,
      includeMedia: true,
    }),
  ];
};

/**
 * Get the schema for a camera's trigger scalars (the events list is rendered
 * separately by the array editor).
 * @param entities The entity IDs offered for the trigger-entities field.
 * @returns The triggers form schema.
 */
export const getCameraTriggersSchema = (): HAFormSchema[] => [
  { name: 'occupancy', selector: { boolean: {} } },
  { name: 'motion', selector: { boolean: {} } },
  { name: 'doorbell', selector: { boolean: {} } },
  { name: 'entities', selector: { entity: { multiple: true } } },
  {
    name: 'media_events',
    label: localize('config.cameras.triggers.media_events.editor_label'),
    selector: createSelectSelector(
      [
        {
          value: 'events',
          label: localize('config.cameras.triggers.media_events.events'),
        },
        {
          value: 'clips',
          label: localize('config.cameras.triggers.media_events.clips'),
        },
        {
          value: 'snapshots',
          label: localize('config.cameras.triggers.media_events.snapshots'),
        },
      ],
      { multiple: true },
    ),
  },
  {
    name: 'reviews',
    type: 'expandable',
    title: localize('config.cameras.triggers.reviews.editor_label'),
    icon: 'mdi:check-circle',
    schema: [
      {
        name: 'severities',
        label: localize('common.severity'),
        selector: createSelectSelector(
          [
            { value: 'high', label: localize('common.severities.high') },
            { value: 'medium', label: localize('common.severities.medium') },
            { value: 'low', label: localize('common.severities.low') },
          ],
          { multiple: true },
        ),
      },
      { name: 'description', selector: { boolean: {} } },
    ],
  },
];

/**
 * Get the schema for a single Home Assistant event trigger.
 * @returns The event form schema.
 */
export const getTriggerEventSchema = (): HAFormSchema[] => [
  { name: 'event_type', selector: { text: {} } },
  { name: 'event_data', selector: { object: {} } },
];
