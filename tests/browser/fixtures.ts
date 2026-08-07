// The media the browser tests use, served by the Vite dev server from where it
// sits in the tree. Two consumers build URLs to it and a third serves copies of
// it (`test-media.ts`), so the path and the names are kept in one place.
const FIXTURES_PATH = '/tests/browser/fixtures';

// A still red image, standing in for anything a camera hands over as a picture:
// a snapshot, or a live view drawn from stills.
export const SNAPSHOT_FIXTURE_FILENAME = 'still-red.png';

// Ten seconds of red, standing in for an event's clip. See fixtures/README.md .
export const CLIP_FIXTURE_FILENAME = 'clip.webm';

export const createFixtureURL = (filename: string): string =>
  `${FIXTURES_PATH}/${filename}`;
