#!/bin/bash

# This script copies icons out of the source tree for documentation.

FRIGATE="./src/camera-manager/frigate/assets/frigate.svg"
IRIS="./src/images/iris.svg"
MOTIONEYE="./src/camera-manager/motioneye/assets/motioneye.svg"
REOLINK="./src/camera-manager/reolink/assets/reolink.svg"
TPLINK="./src/camera-manager/tplink/assets/tplink.svg"

DIR_ICONS="./docs/images/icons"

copy() {
  PATH="$1"
  echo "Copying image $PATH to $DIR_ICONS"
  /bin/cp "$PATH" "$DIR_ICONS"
}

copy "$FRIGATE"
copy "$IRIS"
copy "$MOTIONEYE"
copy "$REOLINK"
copy "$TPLINK"
