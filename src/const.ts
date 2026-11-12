// ===========================================================================
// Top level Advanced Camera Card Constants
// ===========================================================================

export const REPO_URL = 'https://github.com/dermotduffy/advanced-camera-card' as const;
export const DOCS_URL = 'https://card.camera' as const;

export const TROUBLESHOOTING_URL = `${DOCS_URL}/#/troubleshooting` as const;
export const TROUBLESHOOTING_CONFIG_UPGRADE_URL =
  `${TROUBLESHOOTING_URL}?id=configuration-upgrade-available` as const;
export const TROUBLESHOOTING_CONFIG_UPGRADE_FAILURE_URL =
  `${TROUBLESHOOTING_URL}?id=configuration-could-not-be-fully-upgraded` as const;
export const TROUBLESHOOTING_LEGACY_RESOURCE_URL =
  `${TROUBLESHOOTING_URL}?id=legacy-dashboard-resource-detected` as const;
export const TROUBLESHOOTING_MEDIA_URL =
  `${TROUBLESHOOTING_URL}?id=media-unavailable` as const;

// ===========================================================================
// Interaction Constants
// ===========================================================================

// How close to the first tap the second must end for the two to make a double
// tap.
export const DOUBLE_TAP_PIXELS = 40;

// How soon after the first tap the second must end for the two to make a double
// tap.
export const DOUBLE_TAP_SECONDS = 0.25;

// How far a pointer must move to become a drag, which is neither a tap nor a
// hold.
export const DRAG_THRESHOLD_PIXELS = 10;

// How long a pointer must stay down to become a hold.
export const HOLD_SECONDS = 0.4;

// ===========================================================================
// Media Constants
// ===========================================================================

// The number of media items to fetch at a time (for clips/snapshot views, and
// gallery chunks). Smaller values will cause more frequent smaller fetches, but
// improved rendering performance.
export const MEDIA_CHUNK_SIZE_DEFAULT = 50;
