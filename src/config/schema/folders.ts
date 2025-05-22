import { NonEmptyTuple } from 'type-fest';
import { z } from 'zod';
import { AdvancedCameraCardError } from '../../types';
import { isTruthy } from '../../utils/basic';
import { regexSchema } from './common/regex';

export const HA_MEDIA_SOURCE_ROOT = 'media-source://';

export const folderTypeSchema = z.enum(['ha']);
export type FolderType = z.infer<typeof folderTypeSchema>;

const folderConfigDefault = {
  type: 'ha' as const,
  ha: {},
};

const haFolderPathComponentSchema = z.object({
  id: z.string().optional(),

  title: z.string().optional(),
  title_re: regexSchema.optional(),
});
export type HAFolderPathComponent = z.infer<typeof haFolderPathComponentSchema>;

export const transformPathURLToPathArray = (
  url: string,
): NonEmptyTuple<HAFolderPathComponent> => {
  let urlPath = url;
  try {
    const urlObj = new URL(url);
    urlPath = urlObj.pathname;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {}

  const splitPath = decodeURIComponent(urlPath).split(',').filter(isTruthy).slice(1);

  // HA uses a pretty odd URL protocol for media-browser URLs:
  //  - The URL is an encoded comma-separated value representing the folder
  //    hierarchy
  //  - The first component will be `media-browser/browser` representing the
  //    root
  //  - Each subsequent component will start with `media-source://<path>`
  //  - All components except the last will additionally include
  //    '/<media-class>'.
  const folderPath: NonEmptyTuple<HAFolderPathComponent> = [
    { id: HA_MEDIA_SOURCE_ROOT },
    ...splitPath.slice(0, -1).map((split) => ({ id: split.replace(/\/[^/]+$/, '') })),
    ...splitPath.slice(-1).map((split) => ({ id: split })),
  ];

  for (const component of folderPath) {
    if (component.id && !component.id.startsWith(HA_MEDIA_SOURCE_ROOT)) {
      throw new AdvancedCameraCardError(
        `Could not parse valid media source URL: ${url}`,
      );
    }
  }
  return folderPath;
};

const haFolderConfigSchema = z.object({
  url: z.string().transform(transformPathURLToPathArray).optional(),
  path: haFolderPathComponentSchema.array().nonempty().optional(),
});
export type HAFolderConfig = z.infer<typeof haFolderConfigSchema>;

const folderConfigSchema = z.object({
  type: folderTypeSchema.default(folderConfigDefault.type),
  id: z.string().optional(),
  ha: haFolderConfigSchema.default(folderConfigDefault.ha).optional(),
  title: z.string().optional(),
  icon: z.string().optional(),
});
export type FolderConfig = z.infer<typeof folderConfigSchema>;

export const foldersConfigSchema = folderConfigSchema.array();
