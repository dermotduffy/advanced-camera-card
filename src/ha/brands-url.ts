// Small set of utility functions to transform brand URLs. This is a fairly
// hacky approach used by the HA frontend to transform logos (which may be wide
// and not fit well in thumbnails, or may not respect the users themes) into
// icons. In order to ensure consistency of iconography across the card and Home
// Assistant, this is mirrored here.
//
// See: https://github.com/home-assistant/frontend/blob/dev/src/util/brands-url.ts
interface BrandsOptions {
  domain: string;
  type: 'icon' | 'logo' | 'icon@2x' | 'logo@2x';
  useFallback?: boolean;
  darkOptimized?: boolean;
  brand?: boolean;
}

export const brandsUrl = (options: BrandsOptions): string =>
  `https://brands.home-assistant.io/${options.brand ? 'brands/' : ''}${
    options.useFallback ? '_/' : ''
  }${options.domain}/${options.darkOptimized ? 'dark_' : ''}${options.type}.png`;

export const extractDomainFromBrandUrl = (url: string) => url.split('/')[4];

export const isBrandUrl = (thumbnail?: string | null): boolean =>
  !!thumbnail?.startsWith('https://brands.home-assistant.io/');
