import { delay, http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import { beforeAll } from 'vitest';

import { createFixtureURL, SNAPSHOT_FIXTURE_FILENAME } from './fixtures';

const HTTP_NOT_FOUND = 404;
const HTTP_OK = 200;

// Where this worker answers.
const TEST_MEDIA_PATH = '/test-media';

// Requests answered per token, so `responses` can be read as a sequence. One
// page runs one test file, so nothing here is shared with another file.
const requestCounts = new Map<string, number>();

// Whether this page's tests asked for the worker. Recorded so that a URL only
// the worker can answer cannot be built without it.
let inUse = false;

/**
 * See the worker below for what `responses` and `repeat` ask it to do.
 */
const createTestMediaURL = (
  responses: number[],
  repeat = false,
  filename: string = SNAPSHOT_FIXTURE_FILENAME,
): string => {
  if (!inUse) {
    throw new Error(
      'Media that misbehaves must be served in a file using useTestMedia().',
    );
  }

  return (
    // TEST_MEDIA_PATH is intercepted by MSW to allow off-wire testing --
    // without the potential for consuming connections which the browser might
    // need for loading JS itself.
    `${TEST_MEDIA_PATH}/${filename}?` +
    new URLSearchParams({
      token: crypto.randomUUID(),
      responses: responses.join(','),
      repeat: String(repeat),
    }).toString()
  );
};

/**
 * A media URL that fails the given number of times and then works from there
 * on, so a test can make a camera recover rather than only fail.
 */
export const createTemporarilyFailingMediaURL = (
  failures: number,
  filename?: string,
): string =>
  createTestMediaURL([...Array(failures).fill(HTTP_NOT_FOUND), HTTP_OK], true, filename);

/**
 * A media URL that never works, for a camera that is simply broken.
 */
export const createFailingMediaURL = (): string =>
  createTestMediaURL([HTTP_NOT_FOUND], true);

/**
 * A media URL that is never answered, for a camera that accepts the request and
 * then says nothing. Silence is a different failure from a refusal, and the
 * only one that can run a loading timeout out.
 */
export const createUnansweredMediaURL = (): string => createTestMediaURL([]);

/**
 * A media URL that answers once and is then never answered again, for a camera
 * that delivers a picture and goes quiet behind it.
 */
export const createStallingMediaURL = (filename?: string): string =>
  createTestMediaURL([HTTP_OK], false, filename);

/**
 * How many requests a media URL has been asked for, so a test can count what
 * the card actually fetched rather than only what it displayed.
 */
export const getTestMediaRequestCount = (url: string): number => {
  const token = new URL(url, window.location.href).searchParams.get('token');
  return (token ? requestCounts.get(token) : null) ?? 0;
};

/**
 * Serves a fixture at `/test-media/<file>`, behaving as the query asks:
 *
 *   token      Which counter the request belongs to, so that a test's behavior
 *              does not depend on what ran before it. responses  The status to
 *              answer each request with, in order: `200` serves the file and
 *              anything else is sent as an empty error. repeat     What to do
 *              once the `responses` list is exhausted: answer every request
 *              after it as the last one was, or never answer again (i.e. camera
 *              going quiet).
 *
 * Answered from within the page rather than by a server, because a request the
 * page is still waiting on holds one of the handful of connections a browser
 * allows to a host -- and a camera that has gone quiet is exactly a request
 * nobody will ever answer. Held here, it costs nothing: the browser never puts
 * it on the wire.
 *
 * Nothing here waits for a set time. Tests run on a fake clock while requests
 * are served in real time, so a response that is merely slow is a race: run the
 * suite on a loaded machine and it arrives in the middle of a test that assumed
 * it would not.
 */
const worker = setupWorker(
  http.get(`${TEST_MEDIA_PATH}/:file`, async ({ request, params }) => {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return new HttpResponse(null, { status: HTTP_NOT_FOUND });
    }

    const responses = (url.searchParams.get('responses') ?? '')
      .split(',')
      .filter((status) => status !== '')
      .map(Number);

    const answered = requestCounts.get(token) ?? 0;
    requestCounts.set(token, answered + 1);

    const isPastEnd = answered >= responses.length;
    if (isPastEnd && url.searchParams.get('repeat') !== 'true') {
      await delay('infinite');
    }

    const status = responses[isPastEnd ? responses.length - 1 : answered];
    if (status !== HTTP_OK) {
      return new HttpResponse(null, { status });
    }

    // The fixture itself is served by the dev server. A name is sent rather
    // than a path, so nothing outside the fixtures themselves is reachable.
    const fixture = await fetch(createFixtureURL(String(params.file)));

    return fixture.ok
      ? new HttpResponse(await fixture.arrayBuffer(), {
          headers: {
            'Content-Type': fixture.headers.get('Content-Type') ?? 'image/png',
          },
        })
      : new HttpResponse(null, { status: fixture.status });
  }),
);

/**
 * Serve the misbehaving media this page's tests ask for.
 *
 * Called by the files that need it rather than for every page: the worker sees
 * every request the page makes, passing on the ones it does not answer, and a
 * page that has no camera to misbehave gains nothing for that cost.
 */
export const useTestMedia = (): void => {
  beforeAll(async () => {
    // Everything the page loads for itself -- modules, styles, the fixture
    // above -- is left alone.
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
    inUse = true;
  });
};
