import { LitElement } from 'lit';
import { orderBy } from 'lodash-es';
import { dispatchActionExecutionRequest } from '../card-controller/actions/utils/execution-request.js';
import { SubmenuInteraction } from '../components/submenu/types.js';
import {
  MENU_PRIORITY_MAX,
  type ActionType,
  type ActionsConfig,
  type MenuConfig,
  type MenuItem,
} from '../config/types.js';
import { Interaction } from '../types.js';
import {
  convertActionToCardCustomAction,
  getActionConfigGivenAction,
} from '../utils/action';
import { arrayify, isTruthy, setOrRemoveAttribute } from '../utils/basic.js';

export class MenuController {
  protected _host: LitElement;
  protected _config: MenuConfig | null = null;
  protected _buttons: MenuItem[] = [];
  protected _expanded = false;

  constructor(host: LitElement) {
    this._host = host;
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

  public isExpanded(): boolean {
    return this._expanded;
  }

  public setButtons(buttons: MenuItem[]): void {
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

    // If the action is from a submenu, use the attached action config.
    const config: ActionsConfig | null = buttonConfig ?? ev.detail.item ?? null;
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
      (item) => isTruthy(item) && !this._isUnknownActionMenuToggleAction(item),
    );
    if (toggleLessActions.length != actions.length) {
      menuToggle = true;
    }

    if (toggleLessActions.length) {
      dispatchActionExecutionRequest(this._host, {
        action: actions,
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

  protected _sortButtons(): void {
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

  protected _isHidingMenu(): boolean {
    return this._config?.style === 'hidden';
  }

  protected _isUnknownActionMenuToggleAction(action: ActionType): boolean {
    const parsedAction = convertActionToCardCustomAction(action);
    return !!parsedAction && parsedAction.advanced_camera_card_action == 'menu_toggle';
  }
}
