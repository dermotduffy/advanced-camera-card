import { z } from 'zod';

const SSL_CIPHERS = ['default', 'insecure', 'intermediate', 'modern'] as const;
type SSLCiphers = (typeof SSL_CIPHERS)[number];

export const proxyBaseConfigDefault = {
  dynamic: true,
  ssl_ciphers: 'auto' as const,
  ssl_verification: 'auto' as const,
};

export const proxyBaseConfigSchema = z.object({
  dynamic: z.boolean().default(proxyBaseConfigDefault.dynamic),
  ssl_verification: z
    .boolean()
    .or(z.literal('auto'))
    .default(proxyBaseConfigDefault.ssl_verification),
  ssl_ciphers: z
    .enum(SSL_CIPHERS)
    .or(z.literal('auto'))
    .default(proxyBaseConfigDefault.ssl_ciphers),
});
type UnresolvedProxyConfig = z.output<typeof proxyBaseConfigSchema>;

export interface ResolvedProxyConfig {
  dynamic: boolean;
  ssl_verification: boolean;
  ssl_ciphers: SSLCiphers;
}

export interface EnabledProxyConfig extends ResolvedProxyConfig {
  enabled: boolean;

  // Whether proxying is a strict requirement. When false, callers may fall
  // back to the original URL if the proxy integration is unavailable.
  enforce?: boolean;
}

export const resolveProxyConfig = (
  config: UnresolvedProxyConfig,
): ResolvedProxyConfig => ({
  dynamic: config.dynamic,
  ssl_verification: config.ssl_verification === 'auto' ? true : config.ssl_verification,
  ssl_ciphers: config.ssl_ciphers === 'auto' ? 'default' : config.ssl_ciphers,
});
