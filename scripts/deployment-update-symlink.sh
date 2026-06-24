#!/usr/bin/env bash
#
# `yarn deployment-update` -- point the manual-test Home Assistant instance at
# this worktree.
#
# Repoints the `$ACC_LIVE_LINK` symlink (the dev static server's document root)
# at this worktree's `dist/`. HA loads the card from a fixed URL served off that
# static server, so switching worktrees is just this one symlink hop.
set -euo pipefail

if [[ -z "${ACC_LIVE_LINK:-}" ]]; then
  echo "ACC_LIVE_LINK is not set -- point it at the symlink to update." >&2
  exit 1
fi

TARGET="$PWD/dist"
mkdir -p "$(dirname "$ACC_LIVE_LINK")"
ln -sfn "$TARGET" "$ACC_LIVE_LINK"

echo "Advanced Camera Card → $TARGET"
[[ -d "$TARGET" ]] || echo "(no dist/ here yet -- run \`yarn start\` to build it)"
