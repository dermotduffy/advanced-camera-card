import { CONF_CAMERAS, CONF_FOLDERS } from '../../../config/const';
import type { HASelectSelectorOption } from '../../../ha/types';
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

// The forms an editor component asks for. A request carries its indices as
// numbers rather than being named by a path string, so no caller has to build
// a string key and no builder has to pull one apart again.
export type FormRequest =
  | { kind: 'section'; name: string }
  | { kind: 'folder'; index: number }
  | { kind: 'camera'; index: number }
  | { kind: 'camera-triggers'; cameraIndex: number }
  | { kind: 'camera-event'; cameraIndex: number; eventIndex: number };

// The lists a form's dropdowns choose from, gathered from the rest of the
// configuration: the cameras and the folders. Entity fields are not among them:
// they use Home Assistant's own entity picker, which reads the entities itself.
// The cameras are in configuration order, so that a camera's own form can leave
// itself out.
export interface FormRequestOptions {
  cameras: HASelectSelectorOption[];
  folders: HASelectSelectorOption[];
}

const getSectionFormsByName = (name: string): EditorForm[] => {
  switch (name) {
    case 'dimensions':
      return getDimensionsSectionForms();
    case 'image':
      return getImageSectionForms();
    case 'live':
      return getLiveSectionForms();
    case 'media_gallery':
      return getMediaGallerySectionForms();
    case 'media_viewer':
      return getMediaViewerSectionForms();
    case 'menu':
      return getMenuSectionForms();
    case 'performance':
      return getPerformanceSectionForms();
    case 'profiles':
      return getProfilesSectionForms();
    case 'remote_control':
      return getRemoteControlSectionForms();
    case 'status_bar':
      return getStatusBarSectionForms();
    case 'timeline':
      return getTimelineSectionForms();
    case 'view':
      return getViewSectionForms();
    case 'view.keyboard_shortcuts':
      return getViewKeyboardShortcutsSectionForms();
  }
  return [];
};

/**
 * Get the forms for a request.
 * @param request What forms are wanted.
 * @param options The lists the form's dropdowns choose from.
 * @returns The forms, or an empty list for a section that has none.
 */
export const getForms = (
  request: FormRequest,
  options: FormRequestOptions,
): EditorForm[] => {
  switch (request.kind) {
    case 'section':
      return getSectionFormsByName(request.name);
    case 'folder':
      return [{ basePath: [CONF_FOLDERS, request.index], schema: getFolderSchema() }];
    case 'camera':
      return [
        {
          basePath: [CONF_CAMERAS, request.index],
          schema: getCameraSchema({
            // A camera cannot depend on itself.
            otherCameras: options.cameras.filter(
              (_camera, index) => index !== request.index,
            ),
            folders: options.folders,
          }),
        },
      ];
    case 'camera-triggers':
      return [
        {
          basePath: [CONF_CAMERAS, request.cameraIndex, 'triggers'],
          schema: getCameraTriggersSchema(),
        },
      ];
    case 'camera-event':
      return [
        {
          basePath: [
            CONF_CAMERAS,
            request.cameraIndex,
            'triggers',
            'events',
            request.eventIndex,
          ],
          schema: getTriggerEventSchema(),
        },
      ];
  }
};
