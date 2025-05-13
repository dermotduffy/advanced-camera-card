import { z } from 'zod';

export const folderTypeSchema = z.enum(['ha']);
export type FolderType = z.infer<typeof folderTypeSchema>;

const folderConfigDefault = {
  type: 'ha' as const,
  ha: {
    root: 'media-source://',
  },
};

const haFolderConfigSchema = z.object({
  root: z.string().default(folderConfigDefault.ha.root),
  root_url: z.string().optional(),
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
