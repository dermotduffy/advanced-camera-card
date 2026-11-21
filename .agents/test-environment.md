# Hardware available to the maintainer (DRAFT)

What the maintainer personally has to test on. This is not a list of what the
card supports. Agents use it to decide who can perform a release-test check
(see [releases.md](releases.md)) and to avoid writing a check nobody can run.

| Setup                                        | Available?  | Cost to use  |
| -------------------------------------------- | ----------- | ------------ |
| Home Assistant, real instance                | Yes         | Low          |
| Frigate                                      | Yes         | Low          |
| go2rtc                                       | Yes         | Low          |
| macOS desktop                                | Yes         | Low          |
| Android phone, HA Companion app              | Yes         | Low          |
| PTZ camera                                   | Yes         | Low          |
| Cameras: Amcrest, Dahua, Reolink, Tapo, Wyze | Yes         | Low          |
| Camera with 2-way audio                      | Yes         | Low          |
| Doorbell camera                              | No          | --           |
| Chromecast / casting                         | Yes         | High. Avoid. |
| iPhone emulation                             | Yes         | High. Avoid. |
| iPhone or iPad, real device                  | No          | --           |
| Windows                                      | No          | --           |
| Desktop browsers other than Chrome           | Unconfirmed | Unconfirmed  |

Rules:

- A check that needs a setup marked "No" can only be performed by a reporter.
- A check that needs a "High" setup must say why nothing cheaper would do.
- A row marked "Unconfirmed" is treated as "No" until the maintainer fills it
  in.
