import { LitElement } from 'lit';
import { isEqual, orderBy } from 'lodash-es';
import { dispatchActionExecutionRequest } from '../card-controller/actions/utils/execution-request';
import { ActionsConfig, StatusBarItem } from '../config/schema/actions/types';
import { STATUS_BAR_PRIORITY_DEFAULT } from '../config/schema/common/const';
import { StatusBarConfig } from '../config/schema/status-bar';
import { getActionConfigGivenAction } from '../utils/action';
import { arrayify, setOrRemoveAttribute } from '../utils/basic';
import { Timer } from '../utils/timer';
import { AutoHideState, isAutoHidden as evaluateAutoHidden } from './auto-hide';

export class StatusBarController {
  private _host: LitElement;
  private _config: StatusBarConfig | null = null;

  private _popupTimer = new Timer();
  private _items: StatusBarItem[] = [];
  private _autoHideState: AutoHideState | null = null;

  constructor(host: LitElement) {
    this._host = host;
  }

  public getRenderItems(): StatusBarItem[] {
    return this._items;
  }

  public setItems(items: StatusBarItem[]): void {
    const exclusiveItems = items.filter((item) => !!item.exclusive);

    const newItems = orderBy(
      exclusiveItems.length ? exclusiveItems : items,
      (item) => item.priority ?? STATUS_BAR_PRIORITY_DEFAULT,
      'desc',
    );

    const sufficientBefore = this._getSufficientValues(this._items);
    const sufficientAfter = this._getSufficientValues(newItems);

    const hadPermanent = this._hasPermanentItems(this._items);
    this._items = newItems;

    if (this._config?.style === 'popup') {
      const hasPermanent = this._hasPermanentItems(newItems);
      const sufficientChanged = !isEqual(sufficientBefore, sufficientAfter);

      if (hasPermanent) {
        // Permanent items present: show and cancel any running timer.
        this._show();
        this._popupTimer.stop();
      } else if (sufficientChanged) {
        // Sufficient items changed without permanent items: normal popup.
        this._show();
        this._popupTimer.start(this._config.popup_seconds, () => this._hide());
      } else if (hadPermanent && !hasPermanent) {
        // Permanent items just removed: start the popup timer to fade out.
        this._popupTimer.start(this._config.popup_seconds, () => this._hide());
      }
    }

    this._host.requestUpdate();
  }

  public setConfig(config: StatusBarConfig): void {
    this._config = config;
    this._host.style.setProperty(
      '--advanced-camera-card-status-bar-height',
      `${config.height}px`,
    );

    this._host.setAttribute('data-style', config.style);
    this._host.setAttribute('data-position', config.position);

    if (this._config?.style !== 'popup' || this._hasPermanentItems(this._items)) {
      this._show();
    }

    this._host.requestUpdate();
  }

  public getConfig(): StatusBarConfig | null {
    return this._config;
  }

  public setAutoHideState(state: AutoHideState): void {
    this._autoHideState = state;
    this._host.requestUpdate();
  }

  public shouldRender(): boolean {
    if (
      this._config &&
      this._autoHideState &&
      evaluateAutoHidden(this._config.auto_hide, this._autoHideState)
    ) {
      return false;
    }
    return this._items.some(
      (item) => item.enabled !== false && (item.sufficient || item.permanent),
    );
  }

  public actionHandler(
    ev: CustomEvent<{ action: string; config?: ActionsConfig }>,
    config?: ActionsConfig,
  ): void {
    // These interactions should only be handled by the status bar, as nothing
    // upstream has the user-provided configuration.
    ev.stopPropagation();

    const interaction: string = ev.detail.action;
    const action = getActionConfigGivenAction(interaction, config);
    if (!action) {
      return;
    }

    dispatchActionExecutionRequest(this._host, {
      actions: arrayify(action),
      config: config,
    });
  }

  private _getSufficientValue(item: StatusBarItem): string | null {
    /* istanbul ignore else: cannot happen -- @preserve */
    if (item.type === 'custom:advanced-camera-card-status-bar-icon') {
      return item.icon;
    } else if (item.type === 'custom:advanced-camera-card-status-bar-string') {
      return item.string;
    } else if (item.type === 'custom:advanced-camera-card-status-bar-image') {
      return item.image;
    } else {
      return null;
    }
  }

  private _getSufficientValues(items: StatusBarItem[]): (string | null)[] {
    return items
      .filter((item) => item.enabled !== false && item.sufficient)
      .map((item) => this._getSufficientValue(item));
  }

  private _hasPermanentItems(items: StatusBarItem[]): boolean {
    return items.some((item) => item.enabled !== false && item.permanent);
  }

  private _show(): void {
    setOrRemoveAttribute(this._host, false, 'hide');
  }

  private _hide(): void {
    setOrRemoveAttribute(this._host, true, 'hide');
  }
}
