import { expect, it } from 'vitest';
import { browseMediaSchema } from '../../../src/ha/browse-media/types';
import { createBrowseMedia } from '../../test-utils';

it('should lazy evaluate lazy recursive browse media schema', () => {
  expect(browseMediaSchema.parse(createBrowseMedia())).toEqual(createBrowseMedia());
});
