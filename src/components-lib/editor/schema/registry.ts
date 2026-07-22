import type { HASelectSelectorOption } from '../../../ha/types';
import type { EditorForm } from '../types';
import { getEditorModeForms } from './editor-mode';
import {
  getFullCameraEventForms,
  getFullCameraForms,
  getFullCameraTriggersForms,
  getFullFolderForms,
  getFullSectionForms,
} from './full';
import {
  getSimpleCameraForms,
  getSimpleMenuForms,
  getSimpleTopLevelForms,
} from './simple';

// The forms an editor component asks for. A request carries its indices as
// numbers rather than being named by a path string, so no caller has to build
// a string key and no builder has to pull one apart again.
export type FormRequest =
  // The editor mode (simple or full)
  | { kind: 'editor-mode' }

  // Simple mode forms.
  | { kind: 'simple-camera'; index: number }
  | { kind: 'simple-menu' }
  | { kind: 'simple-top-level' }

  // Full mode forms.
  | { kind: 'full-section'; name: string }
  | { kind: 'full-folder'; index: number }
  | { kind: 'full-camera'; index: number }
  | { kind: 'full-camera-triggers'; cameraIndex: number }
  | { kind: 'full-camera-event'; cameraIndex: number; eventIndex: number };

// The lists a form's dropdowns choose from, gathered from the rest of the
// configuration: the cameras and the folders. Entity fields are not among them:
// they use Home Assistant's own entity picker, which reads the entities itself.
// The cameras are in configuration order, so that a camera's own form can leave
// itself out.
export interface FormRequestOptions {
  cameras: HASelectSelectorOption[];
  folders: HASelectSelectorOption[];
}

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
    case 'editor-mode':
      return getEditorModeForms();
    case 'full-section':
      return getFullSectionForms(request.name);
    case 'simple-camera':
      return getSimpleCameraForms(request.index);
    case 'simple-menu':
      return getSimpleMenuForms();
    case 'simple-top-level':
      return getSimpleTopLevelForms();
    case 'full-folder':
      return getFullFolderForms(request.index);
    case 'full-camera':
      return getFullCameraForms(request.index, {
        // A camera cannot depend on itself.
        otherCameras: options.cameras.filter(
          (_camera, index) => index !== request.index,
        ),
        folders: options.folders,
      });
    case 'full-camera-triggers':
      return getFullCameraTriggersForms(request.cameraIndex);
    case 'full-camera-event':
      return getFullCameraEventForms(request.cameraIndex, request.eventIndex);
  }
};
