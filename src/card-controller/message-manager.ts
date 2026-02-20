import { AdvancedCameraCardError, Message, MessageType } from '../types';
import { errorToConsole } from '../utils/basic';
import { CardMessageAPI } from './types';

type MessagePriority = {
  [type in MessageType]: number;
};

const MESSAGE_TYPE_PRIORITIES: MessagePriority = {
  info: 10,
  error: 20,
  connection: 30,
  diagnostics: 40,
};

export class MessageManager {
  private _message: Message | null = null;
  private _api: CardMessageAPI;

  constructor(api: CardMessageAPI) {
    this._api = api;
  }

  public getMessage(): Message | null {
    return this._message;
  }

  public hasMessage(): boolean {
    return !!this._message;
  }

  public hasErrorMessage(): boolean {
    return this._message?.type === 'error';
  }

  public reset(): void {
    const hadMessage = this.hasMessage();
    this._message = null;

    if (hadMessage) {
      this._api.getCardElementManager().update();
    }
  }

  public resetType(type: MessageType): void {
    if (this._message?.type === type) {
      this.reset();
    }
  }

  public setErrorIfHigherPriority(error: unknown, prefix?: string): void {
    // This object should accept unknown objects to be able to seamlessly
    // process arguments to catch() which can only be unknown/any. HA may throw
    // non Error() based errors.
    if (!error || typeof error !== 'object' || !('message' in error)) {
      return;
    }

    errorToConsole(error);
    this.setMessageIfHigherPriority({
      message: prefix ? `${prefix}: ${error.message}` : String(error.message),
      type: 'error',
      ...(error instanceof AdvancedCameraCardError && { context: error.context }),
    });
  }

  public setMessageIfHigherPriority(message: Message): boolean {
    const resolveMessageType = (message: Message): MessageType => {
      return message.type ?? 'info';
    };
    const currentPriority = this._message
      ? MESSAGE_TYPE_PRIORITIES[resolveMessageType(this._message)]
      : 0;
    const newPriority = MESSAGE_TYPE_PRIORITIES[resolveMessageType(message)];

    if (this._message && newPriority < currentPriority) {
      return false;
    }

    this._message = message;

    // When a message is displayed it effectively unloads the media.
    this._api.getMediaLoadedInfoManager().clear();
    this._api.getCardElementManager().scrollReset();
    this._api.getCardElementManager().update();
    return true;
  }
}
