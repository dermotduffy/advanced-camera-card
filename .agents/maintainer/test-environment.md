# Hardware available to the maintainer (DRAFT)

The hardware the maintainer personally has for testing. This is not a list of
what the card supports. Agents use it to decide who can perform a release-test
check (see [releases.md](releases.md)) and to avoid writing a check nobody can
run.

| Setup                                        | Available? | Cost to use  |
| -------------------------------------------- | ---------- | ------------ |
| Home Assistant, real instance                | Yes        | Low          |
| Frigate                                      | Yes        | Low          |
| go2rtc                                       | Yes        | Low          |
| Linux desktop: Chrome, Firefox               | Yes        | Low          |
| macOS desktop: Safari                        | Yes        | Medium       |
| Android phone, HA Companion app              | Yes        | Low          |
| PTZ camera                                   | Yes        | Low          |
| Cameras: Amcrest, Dahua, Reolink, Tapo, Wyze | Yes        | Low          |
| Camera with 2-way audio                      | Yes        | Low          |
| Doorbell camera                              | No         | --           |
| Chromecast / casting                         | Yes        | High. Avoid. |
| iPhone emulation                             | Yes        | High. Avoid. |
| iPhone or iPad, real device                  | No         | --           |
| Windows                                      | No         | --           |

Rules:

- A check that needs a setup marked "No" can only be performed by a reporter.
- A check that needs a "Medium" or "High" setup must say why nothing cheaper
  would do. "High" setups are avoided unless there is no other way.
- Write each browser check for the first browser that can show the problem, in
  this order: Chrome, then Firefox, then Safari.
