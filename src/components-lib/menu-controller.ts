import { LitElement } from 'lit';
import { isEqual, orderBy } from 'lodash-es';
import { dispatchActionExecutionRequest } from '../card-controller/actions/utils/execution-request.js';
import type { LockManagerEpoch } from '../card-controller/lock/types';
import type { SubmenuInteraction } from '../components/submenu/types.js';
import type { ActionConfig, ActionsConfig } from '../config/schema/actions/types.js';
import { MENU_PRIORITY_MAX } from '../config/schema/common/const.js';
import type { MenuItem } from '../config/schema/elements/custom/menu/types.js';
import type { MenuConfig } from '../config/schema/menu.js';
import type { Interaction } from '../types.js';
import { getActionConfigGivenAction } from '../utils/action';
import { arrayify, isTruthy, setOrRemoveAttribute } from '../utils/basic.js';
import { AutoHideState, isAutoHidden as evaluateAutoHidden } from './auto-hide.js';

export class MenuController {
  private _host: LitElement;
  private _config: MenuConfig | null = null;
  private _buttons: MenuItem[] = [];
  private _expanded = false;
  private _lockManagerEpoch?: LockManagerEpoch;
  private _autoHideState: AutoHideState | null = null;

  constructor(host: LitElement) {
    this._host = host;
  }

  public setLockManagerEpoch(lockManagerEpoch?: LockManagerEpoch): void {
    if (isEqual(this._lockManagerEpoch, lockManagerEpoch)) {
      return;
    }
    this._lockManagerEpoch = lockManagerEpoch;
    this._host.requestUpdate();
  }

  /**
   * Whether a menu button should be rendered inert. True if the user explicitly
   * set `inert: true`, OR the active lock policies would block all of the
   * button's configured actions. Submenu containers always stay interactive
   * (tapping one opens the dropdown, which is non-disruptive). Items inside
   * submenus are gated separately by the submenu renderer.
   */
  public shouldButtonBeInert(button: MenuItem): boolean {
    if (button.inert) {
      return true;
    }
    if (!this._lockManagerEpoch?.locked) {
      return false;
    }
    if (
      button.type === 'custom:advanced-camera-card-menu-submenu' ||
      button.type === 'custom:advanced-camera-card-menu-submenu-select'
    ) {
      return false;
    }
    return this._lockManagerEpoch.manager.areAllActionsBlocked(button);
  }

  public setMenuConfig(config: MenuConfig): void {
    this._config = config;
    this._host.style.setProperty(
      '--advanced-camera-card-menu-button-size',
      `${config.button_size}px`,
    );

    // Store the menu style, position and alignment as attributes (used for
    // styling).
    this._host.setAttribute('data-style', config.style);
    this._host.setAttribute('data-position', config.position);
    this._host.setAttribute('data-alignment', config.alignment);

    this._sortButtons();
    this._host.requestUpdate();
  }

  public getMenuConfig(): MenuConfig | null {
    return this._config;
  }

  public setAutoHideState(state: AutoHideState): void {
    this._autoHideState = state;
    this._host.requestUpdate();
  }

  public shouldRender(): boolean {
    if (!this._config || this._config.style === 'none') {
      return false;
    }
    return !(
      this._autoHideState &&
      evaluateAutoHidden(this._config.auto_hide, this._autoHideState)
    );
  }

  public isExpanded(): boolean {
    return this._expanded;
  }

  public setButtons(buttons: MenuItem[]): void {
    if (isEqual(buttons, this._buttons)) {
      return;
    }
    this._buttons = buttons;
    this._sortButtons();
    this._host.requestUpdate();
  }

  public getButtons(alignment: 'matching' | 'opposing'): MenuItem[] {
    const aligned = (button: MenuItem): boolean => {
      return (
        button.alignment === alignment || (alignment === 'matching' && !button.alignment)
      );
    };

    const enabled = (button: MenuItem): boolean => {
      return button.enabled !== false;
    };

    const show = (button: MenuItem): boolean => {
      return !this._isHidingMenu() || this._expanded || !!button.permanent;
    };

    return this._buttons.filter(
      (button) => enabled(button) && aligned(button) && show(button),
    );
  }

  public setExpanded(expanded: boolean): void {
    this._expanded = expanded;
    setOrRemoveAttribute(this._host, expanded, 'expanded');
    this._host.requestUpdate();
  }

  public toggleExpanded(): void {
    this.setExpanded(!this._expanded);
  }

  public handleAction(
    ev: CustomEvent<Interaction & Partial<SubmenuInteraction>>,
    buttonConfig?: ActionsConfig,
  ): void {
    // These interactions should only be handled by the menu, as nothing
    // upstream has the user-provided configuration.
    ev.stopPropagation();

    // Resolve which config the action belongs to. When a click bubbles up from
    // inside a submenu dropdown, the inner submenu component attaches the
    // clicked item on `ev.detail.item` -- prefer that, since it identifies the
    // specific item pressed (not the submenu container). Container clicks and
    // plain top-level icon clicks have no item attached and fall through to
    // `buttonConfig`, which the caller passes in.
    const config: ActionsConfig | null = ev.detail.item ?? buttonConfig ?? null;
    if (!config) {
      return;
    }

    const interaction: string = ev.detail.action;
    const action = getActionConfigGivenAction(interaction, config);
    if (!action) {
      return;
    }
    const actions = arrayify(action);

    // A note on the complexity below: By default the menu should close when a
    // user takes an action, an exception is if the user is specifically
    // manipulating the menu in the actions themselves.
    let menuToggle = false;

    const toggleLessActions = actions.filter(
      (item) => isTruthy(item) && !this._isMenuToggleAction(item),
    );
    if (toggleLessActions.length != actions.length) {
      menuToggle = true;
    }

    if (toggleLessActions.length) {
      dispatchActionExecutionRequest(this._host, {
        actions: actions,
        config: config,
      });
    }

    if (this._isHidingMenu()) {
      if (menuToggle) {
        this.setExpanded(!this._expanded);
      } else {
        // Don't close the menu if there is another action to come.
        const holdAction = getActionConfigGivenAction('hold', config);
        const doubleTapAction = getActionConfigGivenAction('double_tap', config);
        const tapAction = getActionConfigGivenAction('tap', config);
        const endTapAction = getActionConfigGivenAction('end_tap', config);

        if (
          interaction === 'end_tap' ||
          (interaction === 'start_tap' &&
            !holdAction &&
            !doubleTapAction &&
            !tapAction &&
            !endTapAction) ||
          (interaction !== 'end_tap' && !endTapAction)
        ) {
          this.setExpanded(false);
        }
      }
    }
  }

  private _sortButtons(): void {
    this._buttons = orderBy(
      this._buttons,
      (button) => {
        const priority = button.priority ?? 0;
        // If the menu is hidden, the buttons that toggle the menu must come
        // first.
        return (
          priority + (this._isHidingMenu() && button.permanent ? MENU_PRIORITY_MAX : 0)
        );
      },
      ['desc'],
    );
  }

  private _isHidingMenu(): boolean {
    return this._config?.style === 'hidden';
  }

  private _isMenuToggleAction(action: ActionConfig): boolean {
    return (
      action.action === 'fire-dom-event' &&
      action.advanced_camera_card_action === 'menu_toggle'
    );
  }
}
