import { ActionConfig } from '../../config/schema/actions/types';
import { VIEWS_USER_SPECIFIED } from '../../config/schema/common/const';
import { isAdvancedCameraCardCustomAction } from '../../utils/action';
import { CardLockAPI } from '../types';
import type { LockPolicy } from './types';

// Actions that would disrupt an active call. Two categories:
//   - Major media changes (see `ViewManager.hasMajorMediaChange`): view,
//     camera, and substream changes.
//   - Stream-stopping / re-init actions: pause, reload, and casting (which
//     rehosts the stream to a media player).
//
// `call_start` is intentionally absent — it's the entry into the lock.
// `call_end` is also absent — it dispatches via `setViewByParameters({ force:
// true })` to bypass the lock, so listing it here would be redundant.
const CALL_DISRUPTIVE_ACTIONS: ReadonlySet<string> = new Set([
  // View / camera / substream changes.
  ...VIEWS_USER_SPECIFIED,
  'camera_select',

  // Resolves to a configured view at runtime.
  'default',

  // Substreams.
  'live_substream_select',
  'live_substream_on',
  'live_substream_off',

  // Stream-disrupting actions. `play` is intentionally NOT here: it's the
  // recovery path from a paused state.
  'pause',
  'reload',

  // Casting rehosts the stream away from the card.
  'media_player',
]);

export class CallLockPolicy implements LockPolicy {
  private _api: CardLockAPI;

  constructor(api: CardLockAPI) {
    this._api = api;
  }

  public isActive(): boolean {
    if (!this._api.getConfigManager().getConfig()?.live.controls.call.lock) {
      return false;
    }
    return this._api.getCallManager().isActive(this._api.getViewManager().getView());
  }

  public shouldBlockAction(action: ActionConfig): boolean {
    return (
      isAdvancedCameraCardCustomAction(action) &&
      CALL_DISRUPTIVE_ACTIONS.has(action.advanced_camera_card_action)
    );
  }
}
