# Test environment (DRAFT)

What the maintainer can test on in person. Agents use this to decide who can
perform a release-test check (see [releases.md](releases.md)) and to avoid
writing a check nobody can run.

> Every row below was inferred from past issues and sessions and is
> **unconfirmed**. The maintainer should correct this table.

| Setup                              | Available? | Cost to use  |
| ---------------------------------- | ---------- | ------------ |
| Home Assistant, real instance      | Yes        | Low          |
| Desktop Chrome                     | Yes        | Low          |
| Desktop Firefox, Safari            | Unknown    | Unknown      |
| Android phone, HA Companion app    | Yes        | Low          |
| Frigate (two instances)            | Yes        | Low          |
| go2rtc                             | Yes        | Low          |
| Camera with 2-way audio / doorbell | Unknown    | Unknown      |
| PTZ camera                         | No         | --           |
| Reolink camera                     | Unknown    | Unknown      |
| Chromecast / casting               | Yes        | High. Avoid. |
| iPhone or iPad, real device        | No         | --           |
| iPhone emulation                   | Yes        | High. Avoid. |
| Windows                            | No         | --           |

Rules:

- A check that needs a setup marked "No" can only be satisfied by a reporter.
- A check that needs a "High" setup must say why nothing cheaper would do.
- The agent never writes a personal fact from this file into a public reply.
