import { delay, http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import { beforeAll } from 'vitest';

const HTTP_OK = 200;

// Requests answered per token, so `responses` can be read as a sequence. One
// page runs one test file, so nothing here is shared with another file.
const requestCounts = new Map<string, number>();

// Whether this page's tests asked for the worker. Recorded so that a URL only
// the worker can answer cannot be built without it.
let inUse = false;

export const isTestMediaInUse = (): boolean => inUse;

/**
 * Serves a fixture at `/test-media/<file>`, behaving as the query asks:
 *
 *   token      Which counter the request belongs to, so that a test's
 *              behaviour does not depend on what ran before it.
 *   responses  The status to answer each request with, in order: `200` serves
 *              the file and anything else is sent as an empty error. Once the
 *              list runs out, requests are never answered at all, which is how
 *              a camera goes quiet.
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
  http.get('/test-media/:file', async ({ request, params }) => {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return new HttpResponse(null, { status: 404 });
    }

    const responses = (url.searchParams.get('responses') ?? '')
      .split(',')
      .filter((status) => status !== '')
      .map(Number);

    const answered = requestCounts.get(token) ?? 0;
    requestCounts.set(token, answered + 1);

    if (answered >= responses.length) {
      await delay('infinite');
    }

    const status = responses[answered];
    if (status !== HTTP_OK) {
      return new HttpResponse(null, { status });
    }

    // The fixture itself is served by the dev server. A name is sent rather
    // than a path, so nothing outside the fixtures themselves is reachable.
    const fixture = await fetch(`/tests/browser/fixtures/${String(params.file)}`);

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
