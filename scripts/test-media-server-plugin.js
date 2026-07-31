import fs from 'node:fs';
import path from 'node:path';

const FIXTURE_DIRECTORY = 'tests/browser/fixtures';

const CONTENT_TYPES = {
  '.png': 'image/png',
};

const OK = 200;

// Requests answered per token, so `responses` can be read as a sequence.
const requestCounts = new Map();

/**
 * Serves a fixture at `/test-media/<file>`, behaving as the query asks:
 *
 *   token      Which counter the request belongs to. Required, because one
 *              server serves every test in a run and a shared counter would
 *              make a test's behaviour depend on what ran before it.
 *   responses  The status to answer each request with, in order: `200` serves
 *              the file and anything else is sent as an empty error. Once the
 *              list runs out, requests are never answered at all, which is how
 *              a camera goes quiet.
 *
 * Nothing here waits for a set time. Tests run on a fake clock while requests
 * are served in real time, so a response that is merely slow is a race: run the
 * suite on a loaded machine and it arrives in the middle of a test that assumed
 * it would not.
 */
export const testMediaServer = () => ({
  name: 'test-media-server',

  configureServer(server) {
    server.middlewares.use('/test-media', (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');

      // A name rather than a path: nothing outside the fixtures is servable.
      const file = path.basename(url.pathname);
      const contentType = CONTENT_TYPES[path.extname(file)];
      const location = path.resolve(FIXTURE_DIRECTORY, file);
      const token = url.searchParams.get('token');

      if (!contentType || !token || !fs.existsSync(location)) {
        res.statusCode = 404;
        res.end();
        return;
      }

      const responses = (url.searchParams.get('responses') ?? '')
        .split(',')
        .filter((status) => status !== '')
        .map(Number);

      const answered = requestCounts.get(token) ?? 0;
      requestCounts.set(token, answered + 1);

      // Held open deliberately. The socket is released when the test ends and
      // the card that asked for it is torn down.
      if (answered >= responses.length) {
        return;
      }

      const status = responses[answered];
      if (status !== OK) {
        res.statusCode = status;
        res.end();
        return;
      }

      res.setHeader('Content-Type', contentType);
      res.end(fs.readFileSync(location));
    });
  },
});
