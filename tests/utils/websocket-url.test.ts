import { describe, expect, it } from 'vitest';

import { convertToWebSocketURL } from '../../src/utils/websocket-url';

// @vitest-environment jsdom
describe('convertToWebSocketURL', () => {
  it('should convert http to ws', () => {
    expect(convertToWebSocketURL('http://host:1984/api/ws?src=camera')).toBe(
      'ws://host:1984/api/ws?src=camera',
    );
  });

  it('should convert https to wss', () => {
    expect(convertToWebSocketURL('https://host/api/ws?src=camera')).toBe(
      'wss://host/api/ws?src=camera',
    );
  });

  it('should convert a mixed-case scheme', () => {
    expect(convertToWebSocketURL('HtTp://host/api/ws')).toBe('ws://host/api/ws');
  });

  it('should prepend the provided origin to a relative path', () => {
    expect(convertToWebSocketURL('/api/ws?src=camera', 'https://ha:8123')).toBe(
      'wss://ha:8123/api/ws?src=camera',
    );
  });

  it('should prepend the location origin to a relative path by default', () => {
    expect(convertToWebSocketURL('/api/ws?src=camera')).toBe(
      'ws://localhost:3000/api/ws?src=camera',
    );
  });

  it('should leave other schemes untouched', () => {
    expect(convertToWebSocketURL('ws://host/api/ws')).toBe('ws://host/api/ws');
  });
});
