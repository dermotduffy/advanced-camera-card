#!/bin/bash

# This script copies icons out of the source tree for documentation.

FRIGATE="./src/camera-manager/frigate/assets/frigate.svg"
MOTIONEYE="./src/camera-manager/motioneye/assets/motioneye.svg"
REOLINK="./src/camera-manager/reolink/assets/reolink.svg"
DIR_ICONS="./docs/images/icons"

copy() {
  PATH="$1"
  echo "Copying image $PATH to $DIR_ICONS"
  /bin/cp "$PATH" "$DIR_ICONS"
}

copy "$FRIGATE"
copy "$MOTIONEYE"
copy "$REOLINK"
