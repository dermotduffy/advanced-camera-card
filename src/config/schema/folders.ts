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

const parserBaseSchema = z.object({
  regexp: regexSchema.optional(),
});
const startdateParserSchema = parserBaseSchema.extend({
  type: z.literal('startdate'),
  format: z.string().optional(),
});
// Simple alias date -> startdate.
const dateParserSchema = startdateParserSchema.extend({
  type: z.literal('date'),
});
const parserSchema = z.discriminatedUnion('type', [
  dateParserSchema,
  startdateParserSchema,
]);
export type Parser = z.infer<typeof parserSchema>;

const templateMatcherSchema = parserBaseSchema.extend({
  type: z.literal('template'),
  value_template: z.string(),
});
export type TemplateMatcher = z.infer<typeof templateMatcherSchema>;

const titleMatcherSchema = parserBaseSchema.extend({
  type: z.literal('title'),
  regexp: regexSchema.optional(),
  title: z.string().optional(),
});
export type TitleMatcher = z.infer<typeof titleMatcherSchema>;

type OrMatcher = {
  type: 'or';
  matchers: Matcher[];
};
const orMatcherSchema: z.ZodSchema<OrMatcher, z.ZodTypeDef> = z.object({
  type: z.literal('or'),
  matchers: z.array(z.lazy(() => matcherSchema)),
});
export const matcherSchema = z.union([
  orMatcherSchema,
  templateMatcherSchema,
  titleMatcherSchema,
]);
export type Matcher = z.infer<typeof matcherSchema>;

const haFolderPathComponentSchema = z.object({
  id: z.string().optional(),
  parsers: parserSchema.array().optional(),
  matchers: matcherSchema.array().optional(),
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
      throw new AdvancedCameraCardError(`Could not parse media source URL: ${url}`);
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
