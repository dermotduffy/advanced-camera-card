import { CONF_CAMERAS, CONF_FOLDERS } from '../../../config/const';
import type { EditorForm } from '../types';
import {
  getCameraSchema,
  getCameraTriggersSchema,
  getTriggerEventSchema,
} from './cameras';
import { getDimensionsSectionForms } from './dimensions';
import { getFolderSchema } from './folders';
import { getImageSectionForms } from './image';
import { getLiveSectionForms } from './live';
import { getMediaGallerySectionForms } from './media-gallery';
import { getMediaViewerSectionForms } from './media-viewer';
import { getMenuSectionForms } from './menu';
import { getPerformanceSectionForms } from './performance';
import { getProfilesSectionForms } from './profiles';
import { getRemoteControlSectionForms } from './remote-control';
import { getStatusBarSectionForms } from './status-bar';
import { getTimelineSectionForms } from './timeline';
import { getViewKeyboardShortcutsSectionForms, getViewSectionForms } from './view';

// The forms of each section of the full editor, by section name. Kept as a
// lookup rather than a switch so that the full editor's fields can also be
// asked for as a whole, without a second list of the sections to keep in step.
const SECTION_FORM_BUILDERS: Record<string, () => EditorForm[]> = {
  dimensions: getDimensionsSectionForms,
  image: getImageSectionForms,
  live: getLiveSectionForms,
  media_gallery: getMediaGallerySectionForms,
  media_viewer: getMediaViewerSectionForms,
  menu: getMenuSectionForms,
  performance: getPerformanceSectionForms,
  profiles: getProfilesSectionForms,
  remote_control: getRemoteControlSectionForms,
  status_bar: getStatusBarSectionForms,
  timeline: getTimelineSectionForms,
  view: getViewSectionForms,
  'view.keyboard_shortcuts': getViewKeyboardShortcutsSectionForms,
};

/**
 * Get the forms of one section of the full editor.
 * @param name The section name.
 * @returns The section forms, or none for a section that has no forms of its
 * own.
 */
export const getFullSectionForms = (name: string): EditorForm[] =>
  SECTION_FORM_BUILDERS[name]?.() ?? [];

/**
 * Get the form for one camera in the full editor, without its triggers, which
 * are rendered by a hand-built panel so it can host the events list.
 * @param index The camera's position in the configuration.
 * @param options The camera and folder lists the dropdowns choose from.
 * @returns The camera's forms.
 */
export const getFullCameraForms = (
  index: number,
  options: Parameters<typeof getCameraSchema>[0],
): EditorForm[] => [
  { basePath: [CONF_CAMERAS, index], schema: getCameraSchema(options) },
];

/**
 * Get the form for a camera's triggers.
 * @param index The camera's position in the configuration.
 * @returns The triggers forms.
 */
export const getFullCameraTriggersForms = (index: number): EditorForm[] => [
  {
    basePath: [CONF_CAMERAS, index, 'triggers'],
    schema: getCameraTriggersSchema(),
  },
];

/**
 * Get the form for one of a camera's trigger events.
 * @param cameraIndex The camera's position in the configuration.
 * @param eventIndex The event's position within the camera's events.
 * @returns The event's forms.
 */
export const getFullCameraEventForms = (
  cameraIndex: number,
  eventIndex: number,
): EditorForm[] => [
  {
    basePath: [CONF_CAMERAS, cameraIndex, 'triggers', 'events', eventIndex],
    schema: getTriggerEventSchema(),
  },
];

/**
 * Get the form for one folder.
 * @param index The folder's position in the configuration.
 * @returns The folder's forms.
 */
export const getFullFolderForms = (index: number): EditorForm[] => [
  { basePath: [CONF_FOLDERS, index], schema: getFolderSchema() },
];

/**
 * Get every form the full editor shows, wherever it shows it: its sections, and
 * the pages it opens for an item of a list. The items are those at index 0,
 * since every item of a list has the same fields, and the dropdowns are given
 * nothing to choose from since nothing is being chosen.
 * @returns The full editor's forms.
 */
export const getFullEditorForms = (): EditorForm[] => [
  ...Object.values(SECTION_FORM_BUILDERS).flatMap((build) => build()),
  ...getFullCameraForms(0, { otherCameras: [], folders: [] }),
  ...getFullCameraTriggersForms(0),
  ...getFullCameraEventForms(0, 0),
  ...getFullFolderForms(0),
];
