import { describe, expect, it } from 'vitest';
import { getFolderID } from '../../src/utils/folder';

describe('getFolderID', () => {
  it('should get folder id from config', () => {
    expect(getFolderID({ id: 'my-folder' })).toBe('my-folder');
  });

  it('should get folder id from index when no id in config', () => {
    expect(getFolderID({}, 5)).toBe('folder/5');
  });

  it('should use default index 0 when index is missing', () => {
    expect(getFolderID({})).toBe('folder/0');
  });

  it('should handle null config', () => {
    expect(getFolderID(null, 2)).toBe('folder/2');
  });

  it('should handle undefined config', () => {
    expect(getFolderID(undefined, 3)).toBe('folder/3');
  });
});
