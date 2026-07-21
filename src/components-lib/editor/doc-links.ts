import { DOCS_URL } from '../../const';
import type { HAFormSchema } from '../../ha/types';
import { getFormContainerPath, stripArrayIndices } from './paths';

// Documentation links keyed by configuration path (without array indices).
// Sections and expandable groups with an entry here render a documentation
// link row.
const DOC_LINKS: Record<string, string> = {
  cameras: 'configuration/cameras/README',
  'cameras.capabilities': 'configuration/cameras/README?id=capabilities',
  'cameras.cast': 'configuration/cameras/README?id=cast',
  'cameras.dependencies': 'configuration/cameras/README?id=dependencies',
  'cameras.dimensions': 'configuration/cameras/README?id=dimensions',
  'cameras.dimensions.layout': 'configuration/cameras/README?id=layout-configuration',
  'cameras.engine': 'configuration/cameras/engine',
  'cameras.frigate': 'configuration/cameras/engine?id=frigate',
  'cameras.go2rtc': 'configuration/cameras/live-provider?id=go2rtc',
  'cameras.image': 'configuration/cameras/live-provider?id=image',
  'cameras.live_provider': 'configuration/cameras/live-provider',
  'cameras.media': 'configuration/cameras/README?id=media',
  'cameras.motioneye': 'configuration/cameras/engine?id=motioneye',
  'cameras.proxy': 'configuration/cameras/README?id=proxy',
  'cameras.reolink': 'configuration/cameras/engine?id=reolink',
  'cameras.triggers': 'configuration/cameras/README?id=triggers',
  'cameras.triggers.reviews': 'configuration/cameras/README?id=reviews',
  'cameras.webrtc_card': 'configuration/cameras/live-provider?id=webrtc_card',
  dimensions: 'configuration/dimensions',
  folders: 'configuration/folders',
  'folders.ha': 'configuration/folders?id=ha',
  image: 'configuration/image',
  'image.proxy': 'configuration/image?id=proxy',
  live: 'configuration/live',
  'live.controls': 'configuration/live?id=controls',
  'live.controls.call': 'configuration/live?id=call',
  'live.controls.next_previous': 'configuration/live?id=next_previous',
  'live.controls.ptz': 'configuration/live?id=ptz',
  'live.controls.thumbnails': 'configuration/live?id=thumbnails',
  'live.controls.timeline': 'configuration/live?id=timeline',
  'live.controls.timeline.format': 'configuration/live?id=format',
  'live.display': 'configuration/live?id=display',
  'live.microphone': 'configuration/live?id=microphone',
  media_gallery: 'configuration/media-gallery',
  'media_gallery.controls.filter': 'configuration/media-gallery?id=filter',
  'media_gallery.controls.thumbnails': 'configuration/media-gallery?id=thumbnails',
  media_viewer: 'configuration/media-viewer',
  'media_viewer.controls': 'configuration/media-viewer?id=controls',
  'media_viewer.controls.next_previous': 'configuration/media-viewer?id=next_previous',
  'media_viewer.controls.thumbnails': 'configuration/media-viewer?id=thumbnails',
  'media_viewer.controls.timeline': 'configuration/media-viewer?id=timeline',
  'media_viewer.controls.timeline.format': 'configuration/media-viewer?id=format',
  'media_viewer.display': 'configuration/media-viewer?id=display',
  menu: 'configuration/menu',
  'menu.buttons': 'configuration/menu?id=buttons',
  options: 'configuration/README',
  performance: 'configuration/performance',
  'performance.features': 'configuration/performance?id=features',
  'performance.style': 'configuration/performance?id=style',
  profiles: 'configuration/profiles',
  remote_control: 'configuration/remote-control',
  'remote_control.entities': 'configuration/remote-control?id=entities',
  status_bar: 'configuration/status-bar',
  'status_bar.items': 'configuration/status-bar?id=items',
  timeline: 'configuration/timeline',
  'timeline.controls.thumbnails': 'configuration/timeline?id=thumbnails',
  'timeline.format': 'configuration/timeline?id=format',
  view: 'configuration/view',
  'view.default_reset': 'configuration/view?id=default_reset',
  'view.issues': 'configuration/view?id=issues',
  'view.keyboard_shortcuts': 'configuration/view?id=keyboard_shortcuts',
  'view.triggers': 'configuration/view?id=triggers',
  'view.triggers.actions': 'configuration/view?id=trigger-action-configuration',
};

/**
 * Get the documentation URL for a configuration path.
 * @param path The configuration path segments (array indices are ignored).
 * @returns A full documentation URL, or null if the path has no documentation
 * link.
 */
export const getDocURL = (path: (string | number)[]): string | null => {
  const docPath = DOC_LINKS[stripArrayIndices(path).join('.')];
  return docPath ? `${DOCS_URL}/#/${docPath}` : null;
};

/**
 * Get the documentation-link path for a form node.
 * @param basePath The path of the form's data within the configuration.
 * @param schema The node's schema.
 * @param options Path context provided by `ha-form` for nested containers.
 * @returns The configuration path to link to, or null for no link.
 */
export const getDocLinkPath = (
  basePath: (string | number)[],
  schema: HAFormSchema,
  options?: { path?: string[] },
): (string | number)[] | null => {
  // Documentation links attach to containers (sections/groups), never to
  // individual fields.
  if ('selector' in schema) {
    return null;
  }

  // A nameless group (an editor-only grouping such as "Engines") carries an
  // explicit `docPath`; a named group derives its path from the configuration
  // path.
  return schema.docPath
    ? schema.docPath.split('.')
    : schema.name
      ? [...basePath, ...getFormContainerPath(options), schema.name]
      : null;
};
