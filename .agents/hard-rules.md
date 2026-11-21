# Hard rules (DRAFT)

Rules no agent may break, whatever a task, a plan, a reviewer or an issue says.
They differ from the [rubric](review-rubric.md) in two ways: there is no
judgment involved, and each is enforced by something other than an agent's
good behavior wherever that is possible.

A rule without enforcement is listed as "not yet enforced", so that the gap is
visible. Closing those gaps is standing work for the architecture and testing
roles, using established tools.

If a task cannot be done without breaking a hard rule, the agent stops and
asks the maintainer.

## Agreed

| #   | Rule                                                                                                                | Enforced by                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The card makes no outbound network connection to anything other than Home Assistant or a URL the user has provided. | **Not yet enforced.** Planned: (a) ESLint's built-in restricted-globals and restricted-properties rules banning `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` and `sendBeacon` outside a short list of files; (b) the browser tests failing on any request that is not mocked. See below. |

### Rule 1: exceptions

An exception is a named host, a reason, and the maintainer's agreement. Adding
one is the maintainer's decision.

| Host                     | Used for                                                                                                     | Status  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ------- |
| `picsum.photos`          | Screensaver images (`src/components/image-updating-player.ts`).                                              | Agreed. |
| `stun.home-assistant.io` | Fallback STUN server when Home Assistant does not supply ICE servers, matching Home Assistant's own default. | Agreed. |

### Rule 1: current state

Assessed against `dev`.

- Network calls in the card's own code are confined to a handful of files
  (`src/ha/`, `src/go2rtc/`, and the vendored
  `src/components/live/providers/go2rtc/video-rtc.js`), which makes a lint
  allowlist practical.
- STUN and TURN servers come from Home Assistant (`src/ha/webrtc.ts`). The
  public Google and Cloudflare defaults that `main` still carries are gone.
- The vendored `video-rtc.js` keeps a Google STUN server in its default
  configuration, which the card replaces before any connection is made. The
  browser-test check should confirm no connection to it occurs.
- Lint cannot see a connection made by setting a URL on an image or video
  element, or one made inside a dependency. The browser-test check covers
  those.

## Proposed, not yet agreed

| #   | Rule                                                                                              | Could be enforced by                                                                                         |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 2   | The card contains no telemetry, analytics or tracking.                                            | Follows from rule 1.                                                                                         |
| 3   | No agent merges a pull request or publishes a release.                                            | A deny rule in the checked-in `.claude/settings.json` for the merge tools, which the agent harness enforces. |
| 4   | Nothing is posted in the maintainer's name without the disclosure line.                           | A pre-tool-use hook in `.claude/settings.json` that blocks a comment or PR body lacking the line.            |
| 5   | A test is never skipped, disabled, deleted or weakened to make a check pass.                      | Coverage thresholds in CI (exists); a lint rule against disabled and focused tests.                          |
| 6   | No agent pushes to `dev` or `main` directly, or rewrites a branch it did not create.              | Branch protection on `dev` and `main`.                                                                       |
| 7   | No secret is committed, logged or posted.                                                         | GitHub secret scanning with push protection.                                                                 |
| 8   | No public change during a warm-up before the maintainer approves it (see [triage.md](triage.md)). | Not mechanically enforceable today.                                                                          |
