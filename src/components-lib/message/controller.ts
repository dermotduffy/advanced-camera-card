import yaml from 'js-yaml';
import { Link } from '../../config/schema/common/link.js';
import { TROUBLESHOOTING_URL } from '../../const';
import { localize } from '../../localize/localize.js';
import { Message } from '../../types';

export class MessageController {
  public getMessageString(message: Message): string {
    return (
      message.message +
      (message.context && typeof message.context === 'string'
        ? ': ' + message.context
        : '')
    );
  }

  public getIcon(message: Message): string {
    return message.icon
      ? message.icon
      : message.type === 'error'
        ? 'mdi:alert-circle'
        : 'mdi:information-outline';
  }

  public getLink(message: Message): Link | null {
    return message.link
      ? message.link
      : message.type === 'error'
        ? { url: TROUBLESHOOTING_URL, title: localize('error.troubleshooting') }
        : null;
  }

  public getContextStrings(message: Message): string[] {
    if (Array.isArray(message.context)) {
      return message.context.map((contextItem) => yaml.dump(contextItem));
    }
    if (typeof message.context === 'object') {
      return [yaml.dump(message.context)];
    }
    if (typeof message.context === 'string') {
      return [message.context];
    }
    return [];
  }
}
