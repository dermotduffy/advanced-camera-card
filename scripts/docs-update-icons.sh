#!/bin/bash

# This script copies icons out of the source tree for documentation.

DIR_ICONS="./docs/images/icons"

for ICON in ./src/images/icons/*.svg; do
  echo "Copying image $ICON to $DIR_ICONS"
  /bin/cp "$ICON" "$DIR_ICONS"
done
