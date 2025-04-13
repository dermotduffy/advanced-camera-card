import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { customElement, property } from 'lit/decorators.js';
import { DrawerIcons, AdvancedCameraCardDrawer } from './drawer.js';

import './drawer.js';

import surroundBasicStyle from '../scss/surround-basic.scss';

interface AdvancedCameraCardDrawerOpen {
  drawer: 'left' | 'right';
}

@customElement('advanced-camera-card-surround-basic')
export class AdvancedCameraCardSurroundBasic extends LitElement {
  @property({ attribute: false })
  public drawerIcons?: {
    left?: DrawerIcons;
    right?: DrawerIcons;
  };

  protected _refDrawerLeft: Ref<AdvancedCameraCardDrawer> = createRef();
  protected _refDrawerRight: Ref<AdvancedCameraCardDrawer> = createRef();
  protected _boundDrawerHandler = this._drawerHandler.bind(this);

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('advanced-camera-card:drawer:open', this._boundDrawerHandler);
    this.addEventListener('advanced-camera-card:drawer:close', this._boundDrawerHandler);
  }

  disconnectedCallback(): void {
    this.removeEventListener(
      'advanced-camera-card:drawer:open',
      this._boundDrawerHandler,
    );
    this.removeEventListener(
      'advanced-camera-card:drawer:close',
      this._boundDrawerHandler,
    );
    super.disconnectedCallback();
  }

  protected _drawerHandler(ev: Event) {
    const drawer = (ev as CustomEvent<AdvancedCameraCardDrawerOpen>).detail.drawer;
    const open = ev.type.endsWith(':open');
    if (drawer === 'left' && this._refDrawerLeft.value) {
      this._refDrawerLeft.value.open = open;
    } else if (drawer === 'right' && this._refDrawerRight.value) {
      this._refDrawerRight.value.open = open;
    }
  }

  protected render(): TemplateResult | void {
    return html` <slot name="above"></slot>
      <slot></slot>
      <advanced-camera-card-drawer
        ${ref(this._refDrawerLeft)}
        location="left"
        .icons=${this.drawerIcons?.left}
      >
        <slot name="left"></slot>
      </advanced-camera-card-drawer>
      <advanced-camera-card-drawer
        ${ref(this._refDrawerRight)}
        location="right"
        .icons=${this.drawerIcons?.right}
      >
        <slot name="right"></slot>
      </advanced-camera-card-drawer>
      <slot name="below"></slot>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(surroundBasicStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-surround-basic': AdvancedCameraCardSurroundBasic;
  }
}
