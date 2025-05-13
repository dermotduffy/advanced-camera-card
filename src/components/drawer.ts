import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import 'side-drawer';
import { SideDrawer } from 'side-drawer';
import drawerInjectStyle from '../scss/drawer-inject.scss';
import drawerStyle from '../scss/drawer.scss';
import { stopEventFromActivatingCardWideActions } from '../utils/action';
import { getChildrenFromElement, isHoverableDevice } from '../utils/basic';
import './icon';

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

  @property({ attribute: false })
  public icons?: DrawerIcons;

  // The 'empty' attribute is used in the styling to change the drawer
  // visibility and that of all descendants if there is no content. Styling is
  // used rather than display or hidden in order to ensure the contents continue
  // to have a measurable size.
  @property({ type: Boolean, reflect: true, attribute: true })
  public empty = true;

  protected _refDrawer: Ref<HTMLElement & { open: boolean }> = createRef();
  protected _refSlot: Ref<HTMLSlotElement> = createRef();

  protected _resizeObserver = new ResizeObserver(() => this._hideDrawerIfNecessary());

  protected readonly _isHoverableDevice = isHoverableDevice();

  /**
   * Called on the first update.
   * @param changedProps The changed properties.
   */
  protected firstUpdated(changedProps: PropertyValues): void {
    super.firstUpdated(changedProps);

    // The `side-drawer` component (and the material drawer for that matter)
    // only do fixed drawers (i.e. a drawer for the whole viewport). Hackily
    // override the style to customize the drawer to be absolute within the div.
    const style = document.createElement('style');
    style.innerHTML = drawerInjectStyle;
    this._refDrawer.value?.shadowRoot?.appendChild(style);
  }

  protected _slotChanged(): void {
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

  protected _hideDrawerIfNecessary(): void {
    if (!this._refDrawer.value) {
      return;
    }

    const children = this._refSlot.value
      ? getChildrenFromElement(this._refSlot.value)
      : null;
    this.empty =
      !children ||
      !children.length ||
      children.every((element) => {
        const box = element.getBoundingClientRect();
        return !box.width || !box.height;
      });
  }

  protected render(): TemplateResult {
    return html`
      <side-drawer
        ${ref(this._refDrawer)}
        location="${this.location}"
        ?open=${this.open}
        @blur=${() => {
          if (this.open) {
            this.open = false;
          }
        }}
      >
        ${this.control
          ? html`
              <div
                class="control-surround"
                @click=${(ev: Event) => {
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
            `
          : ''}
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
