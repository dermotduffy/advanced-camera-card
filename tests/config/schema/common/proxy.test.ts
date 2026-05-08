import { describe, expect, it } from 'vitest';
import {
  proxyBaseConfigDefault,
  proxyBaseConfigSchema,
  resolveProxyConfig,
} from '../../../../src/config/schema/common/proxy';

describe('proxyBaseConfigSchema', () => {
  it('should fill in defaults from an empty object', () => {
    expect(proxyBaseConfigSchema.parse({})).toEqual(proxyBaseConfigDefault);
  });

  it.each([true, false, 'auto'])(
    'should accept ssl_verification value %s',
    (value) => {
      expect(proxyBaseConfigSchema.parse({ ssl_verification: value }).ssl_verification)
        .toEqual(value);
    },
  );

  it.each(['default', 'insecure', 'intermediate', 'modern', 'auto'])(
    'should accept ssl_ciphers value %s',
    (value) => {
      expect(proxyBaseConfigSchema.parse({ ssl_ciphers: value }).ssl_ciphers).toEqual(
        value,
      );
    },
  );

  it('should reject an unrecognised ssl_ciphers value', () => {
    expect(proxyBaseConfigSchema.safeParse({ ssl_ciphers: 'banana' }).success).toBe(
      false,
    );
  });

  it('should reject an unrecognised ssl_verification value', () => {
    expect(
      proxyBaseConfigSchema.safeParse({ ssl_verification: 'sometimes' }).success,
    ).toBe(false);
  });

  it('should reject a non-boolean dynamic value', () => {
    expect(proxyBaseConfigSchema.safeParse({ dynamic: 'yes' }).success).toBe(false);
  });
});

describe('resolveProxyConfig', () => {
  it('should resolve the auto sentinels to concrete defaults', () => {
    expect(
      resolveProxyConfig({
        dynamic: true,
        ssl_verification: 'auto',
        ssl_ciphers: 'auto',
      }),
    ).toEqual({
      dynamic: true,
      ssl_verification: true,
      ssl_ciphers: 'default',
    });
  });

  it('should pass through explicit values unchanged', () => {
    expect(
      resolveProxyConfig({
        dynamic: false,
        ssl_verification: false,
        ssl_ciphers: 'modern',
      }),
    ).toEqual({
      dynamic: false,
      ssl_verification: false,
      ssl_ciphers: 'modern',
    });
  });
});
