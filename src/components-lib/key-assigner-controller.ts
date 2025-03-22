import { LitElement, ReactiveController } from 'lit';
import isEqual from 'lodash-es/isEqual';
import { KeyboardShortcut } from '../config/schema/view';
import { setOrRemoveAttribute } from '../utils/basic';

export class KeyAssignerController implements ReactiveController {
  protected _host: LitElement;
  protected _assigning = false;
  protected _value: KeyboardShortcut | null = null;

  constructor(host: LitElement) {
    this._host = host;
    this._host.addController(this);
  }

  public setValue(value: KeyboardShortcut | null): void {
    if (!isEqual(value, this._value)) {
      this._value = value;
      this._host.requestUpdate();

      this._host.dispatchEvent(
        new CustomEvent('value-changed', {
          detail: {
            value: this._value,
          },
        }),
      );
    }
  }
  public getValue(): KeyboardShortcut | null {
    return this._value;
  }
  public hasValue(): boolean {
    return !!this._value;
  }

  public isAssigning(): boolean {
    return this._assigning;
  }
  public toggleAssigning(): void {
    this._setAssigning(!this._assigning);
  }
  protected _setAssigning(assigning: boolean): void {
    this._assigning = assigning;
    setOrRemoveAttribute(this._host, this._assigning, 'assigning');

    if (this._assigning) {
      this._host.addEventListener('keydown', this._keydownEventHandler);
    } else {
      this._host.removeEventListener('keydown', this._keydownEventHandler);
    }

    this._host.requestUpdate();
  }

  protected _blurEventHandler = (): void => {
    this._setAssigning(false);
  };

  protected _keydownEventHandler = (ev: KeyboardEvent): void => {
    // Don't allow _only_ a modifier.
    if (!ev.key || ['Control', 'Alt', 'Shift', 'Meta'].includes(ev.key)) {
      return;
    }

    this.setValue({
      key: ev.key,
      ctrl: ev.ctrlKey,
      alt: ev.altKey,
      shift: ev.shiftKey,
      meta: ev.metaKey,
    });
    this._setAssigning(false);
  };

  public hostConnected(): void {
    this._host.addEventListener('blur', this._blurEventHandler);
  }

  public hostDisconnected(): void {
    this._host.removeEventListener('blur', this._blurEventHandler);
  }
}
