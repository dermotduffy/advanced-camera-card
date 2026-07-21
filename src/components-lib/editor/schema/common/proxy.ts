import type {
  HAFormExpandableSchema,
  HAFormSchema,
  HASelectSelectorOption,
} from '../../../../ha/types';
import { localize } from '../../../../localize/localize';
import { createSelectSelector } from './selectors';

/**
 * Get the schema for a media proxy group.
 * @param options The group title and which optional fields to include.
 * @returns The form schema for the group.
 */
export const getProxySchema = (options: {
  title: string;
  includeEnabled?: boolean;
  includeLive?: boolean;
  includeMedia?: boolean;
}): HAFormExpandableSchema => {
  const proxyModeOptions: HASelectSelectorOption[] = [
    { value: 'auto', label: localize('config.common.proxy.modes.auto') },
    { value: true, label: localize('config.common.proxy.modes.true') },
    { value: false, label: localize('config.common.proxy.modes.false') },
  ];

  const schema: HAFormSchema[] = [];
  if (options.includeEnabled) {
    schema.push({
      name: 'enabled',
      label: localize('config.common.proxy.modes.true'),
      selector: { boolean: {} },
    });
  }
  if (options.includeLive) {
    schema.push({
      name: 'live',
      label: localize('config.cameras.proxy.live'),
      selector: createSelectSelector(proxyModeOptions),
    });
  }
  if (options.includeMedia) {
    schema.push({
      name: 'media',
      label: localize('config.cameras.proxy.media'),
      selector: createSelectSelector(proxyModeOptions),
    });
  }
  schema.push(
    {
      name: 'dynamic',
      label: localize('config.common.proxy.dynamic'),
      selector: { boolean: {} },
    },
    {
      name: 'ssl_verification',
      label: localize('config.common.proxy.ssl_verification.editor_label'),
      selector: createSelectSelector([
        {
          value: 'auto',
          label: localize('config.common.proxy.ssl_verification.auto'),
        },
        {
          value: true,
          label: localize('config.common.proxy.ssl_verification.true'),
        },
        {
          value: false,
          label: localize('config.common.proxy.ssl_verification.false'),
        },
      ]),
    },
    {
      name: 'ssl_ciphers',
      label: localize('config.common.proxy.ssl_ciphers.editor_label'),
      selector: createSelectSelector([
        { value: 'auto', label: localize('config.common.proxy.ssl_ciphers.auto') },
        {
          value: 'default',
          label: localize('config.common.proxy.ssl_ciphers.default'),
        },
        {
          value: 'insecure',
          label: localize('config.common.proxy.ssl_ciphers.insecure'),
        },
        {
          value: 'intermediate',
          label: localize('config.common.proxy.ssl_ciphers.intermediate'),
        },
        {
          value: 'modern',
          label: localize('config.common.proxy.ssl_ciphers.modern'),
        },
      ]),
    },
  );

  return {
    name: 'proxy',
    type: 'expandable',
    title: options.title,
    icon: 'mdi:arrow-decision',
    schema,
  };
};
