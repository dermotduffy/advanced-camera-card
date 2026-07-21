import type { RawAdvancedCameraCardConfig } from '../../config/types';
import type { HAFormSchema } from '../../ha/types';

// The location of a value within a configuration. Numbers address array items.
export type ConfigPath = (string | number)[];

// A change to make to a configuration, at an absolute path.
export type ConfigChange =
  | { path: ConfigPath; type: 'set'; value: unknown }
  | { path: ConfigPath; type: 'delete' };

// Where a form field's value lives in the configuration, for the fields whose
// location is not simply their position within the form.
//
// A field is addressed by `formPath`, its path within the form's own data. By
// default that path is also its path within the configuration (below the form's
// base path), which is what the ordinary section forms rely on. A binding
// overrides that, either by naming a different configuration path, or by
// reading and writing the value itself for a field whose form representation
// differs from the way it is stored.
//
// `formPath` must name a field, not a group: a group's fields are bound
// individually. A `formPath` naming no field of the form binds nothing.
//
// A binding matters only for a form that gathers fields from across the
// configuration rather than editing one subtree; a form bound to a single
// subtree never needs one.
export type FieldBinding = PathFieldBinding | ComputedFieldBinding;

// A field stored at a configuration path of its own, unchanged.
interface PathFieldBinding {
  formPath: string[];
  configPath: ConfigPath;
}

// A field whose form representation differs from the way it is stored, and
// which therefore reads and writes itself.
interface ComputedFieldBinding {
  formPath: string[];

  // The value to show for the field, given the whole configuration and the
  // configuration defaults.
  read: (
    config: RawAdvancedCameraCardConfig,
    defaults: RawAdvancedCameraCardConfig,
  ) => unknown;

  // The changes that storing a new value for the field represents. The
  // defaults are given as well as the configuration so that a field returning
  // to its default can be deleted rather than written out: one form field may
  // stand for many configuration keys, and writing every one of them would
  // fill the configuration with values the user never set.
  write: (
    value: unknown,
    config: RawAdvancedCameraCardConfig,
    defaults: RawAdvancedCameraCardConfig,
  ) => ConfigChange[];
}

export const isComputedFieldBinding = (
  binding: FieldBinding,
): binding is ComputedFieldBinding => 'read' in binding;

// One `ha-form` for part of a section. A section splits into more than one of
// these when its fields live at different configuration paths, since each form
// binds to a single base path. For example, the timeline section uses one form
// for its top-level fields (`timeline.*`) and another for its thumbnail
// controls (`timeline.controls.thumbnails.*`).
export interface EditorForm {
  // The path of this form's data within the configuration; empty if it edits
  // the configuration root.
  basePath: ConfigPath;
  schema: HAFormSchema[];

  // Fields that are not stored where their position in the form implies. A
  // form gathering fields from across the configuration (rather than editing
  // one subtree) uses these.
  bindings?: FieldBinding[];
}
