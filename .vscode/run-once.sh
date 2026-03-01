#!/usr/bin/env bash
# Ensures only one instance of a command runs at a time. If a previous
# instance is still running (e.g. orphaned after a VS Code crash), it is
# killed before starting the new one.
#
# Kills the entire process tree (not just the stored PID) because `yarn`
# spawns child processes (e.g. rollup/node) that hold the port. After
# killing, waits for the port to be released before starting the new
# instance.
#
# Usage: run-once.sh <pidfile> <port> <command...>

set -euo pipefail

PIDFILE="$1"; shift
PORT="$1"; shift

kill_tree() {
  local pid="$1"
  # Kill children first (depth-first), then the parent.
  pkill -TERM -P "$pid" 2>/dev/null || true
  kill "$pid" 2>/dev/null || true
  tail --pid="$pid" -f /dev/null 2>/dev/null || true
}

wait_for_port() {
  local port="$1"
  local attempts=0
  while ss -tlnp | grep -q ":${port} " && [ $attempts -lt 30 ]; do
    sleep 0.2
    attempts=$((attempts + 1))
  done
}

if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill_tree "$OLD_PID"
  fi
  rm -f "$PIDFILE"
  wait_for_port "$PORT"
fi

trap 'rm -f "$PIDFILE"' EXIT
echo $$ > "$PIDFILE"
exec "$@"
