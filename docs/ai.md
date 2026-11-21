# How AI Is Used in This Project

This card is a hobby project with one maintainer. It gets far more issues and
requests than one person can keep up with. AI agents do much of the work so
that bugs get fixed and questions get answered sooner. This page explains what
they do, what they do not do, and how to reach a human.

## What you will see

Anything an AI agent posts on GitHub in the maintainer's name starts with this
line:

> _Posted by an AI agent on behalf of the maintainer ([how AI is used in this project](https://card.camera/#/ai))._

If a comment from the maintainer's account does not start with that line, the
maintainer wrote it.

## What agents do

- **Investigate bug reports.** An agent tries to reproduce the problem from
  your configuration and diagnostics, usually by writing a test.
- **Triage.** Agents label issues and set their priority.
- **Fix bugs and build features.** Agents write the code, tests and
  documentation, and review each other's work.
- **Review pull requests.** A different AI model reviews every pull request,
  including those from contributors, and may comment on it.
- **Reply, in a small number of fixed cases** (see below).

## What a human always does

- **Merges every change.** Nothing reaches a release without the maintainer
  merging it.
- **Decides what the card's configuration looks like.** Every new or changed
  option is approved by the maintainer before it is built.
- **Decides to decline or close a request.** An agent will never tell you a
  feature is not going to happen, or close your issue as not planned.
- **Decides whether a problem lies with another project** (Home Assistant,
  Frigate, go2rtc and so on).
- **Decides the direction of contributed pull requests.**

## Replies an agent may post without asking the maintainer

An agent may only post these. Anything else is written or approved by the
maintainer.

| Reply                                                      | When                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A request for card diagnostics                             | A bug report arrives without them.                                           |
| Up to three specific questions, or a minimal config to try | The agent could not reproduce the problem and has a specific idea about why. |
| "This is already possible", with a config example          | The agent has checked that the config is valid and does what you asked.      |
| "Fixed in version X"                                       | A test shows the problem on your version and not on the current one.         |
| "Duplicate of #N"                                          | Another open issue has the same symptom and the same cause.                  |
| A request to open a new issue                              | A comment raises an unrelated problem on an existing issue.                  |
| "Reproduced, and queued for a fix"                         | The agent has reproduced the bug with a test. No date is promised.           |

An agent asks questions on an issue at most twice. If the problem is still
not understood after that, the issue goes to the maintainer with everything
gathered so far. Agents will not keep asking you questions indefinitely.

## Reaching a human

If an agent's reply is wrong or unhelpful, or you would rather deal with a
person, say so in a comment on the issue. The agent then stops replying on that
issue and passes it to the maintainer.

Please bear in mind that this is a hobby project. A human reply may take a
while.

## If you contribute code

- Your pull request will be reviewed by an AI model, and you may get comments
  from it. You are welcome to disagree with them.
- The maintainer decides whether and how a contribution is merged.
- If you allow edits by maintainers on your pull request, the maintainer or
  the maintainer's AI agents may change it directly so that it can be merged.
  These changes are new commits on your branch. Your commits and credit are
  kept. If you do not allow edits, you will get the requested changes as
  comments instead.
- The standards agents work to are public, in
  [`.agents/standards/`](https://github.com/dermotduffy/advanced-camera-card/tree/main/.agents/standards),
  and apply equally to AI and human contributions.
- You are welcome to use AI tools yourself. You are responsible for what you
  submit.
