import { z } from 'zod';
import { actionsSchema } from './actions/types';
import { imageBaseConfigDefault, imageBaseConfigSchema } from './common/image';
import { proxyBaseConfigDefault, proxyBaseConfigSchema } from './common/proxy';

export const imageConfigDefault = {
  ...imageBaseConfigDefault,
  proxy: {
    ...proxyBaseConfigDefault,
    enabled: false,
  },
  zoomable: true,
};

const imageProxyConfigSchema = proxyBaseConfigSchema.extend({
  enabled: z.boolean().default(imageConfigDefault.proxy.enabled),
});
export type ImageViewProxyConfig = z.infer<typeof imageProxyConfigSchema>;

export const imageConfigSchema = imageBaseConfigSchema
  .extend({
    proxy: imageProxyConfigSchema.optional(),
    zoomable: z.boolean().default(imageConfigDefault.zoomable),
  })
  .extend(actionsSchema.shape)
  .default(imageConfigDefault);

export type ImageViewConfig = z.infer<typeof imageConfigSchema>;
