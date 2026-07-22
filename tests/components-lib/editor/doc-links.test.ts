import { describe, expect, it } from 'vitest';

import { getDocLinkPath, getDocURL } from '../../../src/components-lib/editor/doc-links';

describe('getDocURL', () => {
  it('should return the documentation URL for a known path', () => {
    expect(getDocURL(['live', 'controls', 'thumbnails'])).toBe(
      'https://card.camera/#/configuration/live?id=thumbnails',
    );
  });

  it('should ignore array indices', () => {
    expect(getDocURL(['cameras', 0, 'triggers'])).toBe(
      'https://card.camera/#/configuration/cameras/README?id=triggers',
    );
  });

  it('should return null for a path without documentation', () => {
    expect(getDocURL(['unknown', 'path'])).toBeNull();
  });
});

describe('getDocLinkPath', () => {
  it('should not link a field', () => {
    expect(
      getDocLinkPath(['cameras'], { name: 'title', selector: { text: {} } }),
    ).toBeNull();
  });

  it('should link a group by its explicit documentation path', () => {
    expect(
      getDocLinkPath(['cameras', 2], {
        type: 'expandable',
        docPath: ['cameras', 'engine'],
        schema: [],
      }),
    ).toEqual(['cameras', 'engine']);
  });

  it('should not link a group that has neither a name nor a path', () => {
    expect(getDocLinkPath(['cameras'], { type: 'expandable', schema: [] })).toBeNull();
  });

  it('should not link a grid', () => {
    // A grid only lays out the fields within it, and documentation is linked
    // for what a group of settings is, not for how it is arranged.
    expect(getDocLinkPath(['dimensions'], { type: 'grid', schema: [] })).toBeNull();
  });

  it('should order nested container paths into configuration order', () => {
    expect(
      getDocLinkPath(
        ['cameras', 2],
        { name: 'dashboard', type: 'expandable', schema: [] },
        { path: ['cast'] },
      ),
    ).toEqual(['cameras', 2, 'cast', 'dashboard']);
  });
});
