import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import 'side-drawer';

import type { SideDrawer } from 'side-drawer';

import drawerInjectStyle from '../scss/drawer-inject.scss?inline';
import drawerStyle from '../scss/drawer.scss?inline';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import {
  contentsChanged,
  getChildrenFromElement,
  isHoverableDevice,
  isPointInBox,
} from '../utils/basic.js';

import './icon.js';

export interface DrawerIcons {
  open?: string;
  closed?: string;
}

@customElement('advanced-camera-card-drawer')
export class AdvancedCameraCardDrawer extends LitElement {
  @property({ attribute: true, reflect: true })
  public location: 'left' | 'right' = 'left';

  @property({ attribute: true, reflect: true, type: Boolean })
  public control = true;

  @property({ type: Boolean, reflect: true, attribute: true })
  public open = false;

  @property({ type: Boolean, reflect: true, attribute: true })
  public locked?: boolean;

  @property({ type: Boolean })
  public pinned = false;

  @property({ attribute: false, hasChanged: contentsChanged })
  public icons?: DrawerIcons;

  // The 'empty' attribute is used in the styling to change the drawer
  // visibility and that of all descendants if there is no content. Styling is
  // used rather than display or hidden in order to ensure the contents continue
  // to have a measurable size.
  @property({ type: Boolean, reflect: true, attribute: true })
  public empty = true;

  private _refDrawer: Ref<SideDrawer> = createRef();
  private _refSlot: Ref<HTMLSlotElement> = createRef();

  private _resizeObserver = new ResizeObserver(() => this._hideDrawerIfNecessary());

  private readonly _isHoverableDevice = isHoverableDevice();

  /**
   * Called on the first update.
   * @param changedProps The changed properties.
   */
  protected firstUpdated(changedProps: PropertyValues): void {
    super.firstUpdated(changedProps);

    const root = this._refDrawer.value?.shadowRoot;
    if (!root) {
      return;
    }

    // side-drawer 4 only ships a viewport-fixed dialog. The injected sheet
    // makes that dialog absolute within the card. `show()` (not `showModal()`,
    // which is what the library's `open` attribute calls) keeps it in the card
    // instead of covering the viewport.
    const style = document.createElement('style');
    style.innerHTML = drawerInjectStyle;
    root.appendChild(style);
    this._syncDialogOpenState();
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (changedProps.has('empty') || changedProps.has('open')) {
      this._syncDialogOpenState();
    }
    if (changedProps.has('open') && this.open) {
      // Layout for slotted content only exists after `dialog.show()`.
      requestAnimationFrame(() => this._hideDrawerIfNecessary());
    }

    // If the pinned property changes, check whether the drawer should be
    // closed.
    if (
      changedProps.has('pinned') &&
      !this.pinned &&
      changedProps.get('pinned') &&
      this.open &&
      this._isHoverableDevice &&
      !this.matches(':hover')
    ) {
      this.open = false;
    }
  }

  private _syncDialogOpenState(): void {
    const dialog = this._refDrawer.value?.shadowRoot?.querySelector('dialog');
    if (!dialog) {
      return;
    }

    // Only keep the dialog open while the drawer is open. An always-on
    // `show()` dialog steals Tab focus and hit-tests on Firefox and WebKit,
    // even with `pointer-events: none`. The handle lives outside the dialog so
    // it stays reachable while the panel is closed.
    if (this.open && !this.empty) {
      if (!dialog.open) {
        dialog.show();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }

  protected willUpdate(): void {
    if (this.locked && this.open) {
      this.open = false;
    }
  }

  private _slotChanged(): void {
    const children = this._refSlot.value
      ? getChildrenFromElement(this._refSlot.value)
      : [];

    // Watch all slot children for size changes.
    this._resizeObserver.disconnect();
    for (const child of children) {
      this._resizeObserver.observe(child);
    }
    this._hideDrawerIfNecessary();
  }

  private _hideDrawerIfNecessary(): void {
    if (!this._refDrawer.value) {
      return;
    }

    const children = this._refSlot.value
      ? getChildrenFromElement(this._refSlot.value)
      : null;
    if (!children || !children.length) {
      this.empty = true;
      return;
    }

    // A closed <dialog> reports zero size for its contents, so presence of
    // children is enough to show the handle while the panel is closed.
    if (!this.open) {
      this.empty = false;
      return;
    }

    this.empty = children.every((element) => {
      const box = element.getBoundingClientRect();
      return !box.width || !box.height;
    });
  }

  private _renderControl(): TemplateResult {
    return html`
      <div
        class="control-surround"
        @click=${(ev: Event) => {
          // While locked the drawer must not open. Return before
          // `stopEventFromActivatingCardWideActions` so a click on the
          // padded control wrapper is not swallowed and can still fall
          // through to card-wide actions.
          if (this.locked) {
            return;
          }
          stopEventFromActivatingCardWideActions(ev);
          this.open = !this.open;
        }}
      >
        <advanced-camera-card-icon
          class="control"
          .icon="${{
            icon: this.open
              ? this.icons?.open ?? 'mdi:menu-open'
              : this.icons?.closed ?? 'mdi:menu',
          }}"
          @mouseenter=${() => {
            // Only open the drawer on mousenter when the device
            // supports hover (otherwise iOS may end up passing on
            // subsequent click events to a different element, see:
            // https://github.com/dermotduffy/advanced-camera-card/issues/801
            if (this._isHoverableDevice && !this.open) {
              this.open = true;
            }
          }}
        >
        </advanced-camera-card-icon>
      </div>
    `;
  }

  protected render(): TemplateResult {
    return html`
      ${this.control ? this._renderControl() : ''}
      <side-drawer
        ${ref(this._refDrawer)}
        ?right=${this.location === 'right'}
        ?data-open=${this.open}
        ?data-empty=${this.empty}
        @mouseleave=${(ev: MouseEvent) => {
          if (!this._isHoverableDevice) {
            return;
          }

          // Only close the drawer if the pointer has left the drawer area.
          const box = this._refDrawer.value?.getBoundingClientRect();
          if (box && isPointInBox({ x: ev.clientX, y: ev.clientY }, box)) {
            return;
          }

          if (this.pinned) {
            return;
          }

          this.open = false;
        }}
      >
        <slot ${ref(this._refSlot)} @slotchange=${() => this._slotChanged()}></slot>
      </side-drawer>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(drawerStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-drawer': AdvancedCameraCardDrawer;
    'side-drawer': SideDrawer;
  }
}
