#!/bin/bash

set -euxo pipefail

git submodule update --init

.devcontainer/frigate-hass-integration/.devcontainer/scripts/devcontainer_initialize.sh

echo "$0 finished." >&2
