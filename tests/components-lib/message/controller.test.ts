import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { MessageController } from '../../../src/components-lib/message/controller';
import { TROUBLESHOOTING_URL } from '../../../src/const';
import { localize } from '../../../src/localize/localize';
import { Message, MessageType, MessageURL } from '../../../src/types';

describe('MessageController', () => {
  describe('should return the correct message string', () => {
    it('should return simple message string', () => {
      const controller = new MessageController();
      const message: Message = {
        message: 'Message',
        type: 'info',
      };
      expect(controller.getMessageString(message)).toBe('Message');
    });

    it('should embed simple string context', () => {
      const controller = new MessageController();
      const message: Message = {
        message: 'Message',
        context: 'Context',
        type: 'info',
      };
      expect(controller.getMessageString(message)).toBe('Message: Context');
    });
  });

  describe('should return the correct icon', () => {
    describe('when icon is specified', () => {
      it.each([['info' as const], ['error' as const], ['connection' as const]])(
        '%s',
        (type: MessageType) => {
          const controller = new MessageController();
          const message: Message = {
            message: 'Message',
            icon: 'mdi:car',
            type,
          };
          expect(controller.getIcon(message)).toBe('mdi:car');
        },
      );
    });

    it('when type is an error', () => {
      const controller = new MessageController();
      const message: Message = {
        message: 'Message',
        type: 'error',
      };
      expect(controller.getIcon(message)).toBe('mdi:alert-circle');
    });

    it('by default', () => {
      const controller = new MessageController();
      const message: Message = {
        message: 'Message',
      };
      expect(controller.getIcon(message)).toBe('mdi:information-outline');
    });
  });

  describe('should show troubleshooting link', () => {
    it('should show for errors', () => {
      const controller = new MessageController();
      const message: Message = { message: 'Error message', type: 'error' };
      expect(controller.getURL(message)).toEqual({
        link: TROUBLESHOOTING_URL,
        title: localize('error.troubleshooting')
      });
    });

    describe('should not show for other types', () => {
      it.each([['info' as const], ['connection' as const]])(
        '%s',
        (type: MessageType) => {
          const controller = new MessageController();
          const message: Message = {
            message: 'Message',
            icon: 'mdi:car',
            type,
          };
          expect(controller.getURL(message)).toBeNull();
        },
      );
    });

    describe('should show correct URL', () => {
      it('by default', () => {
        const controller = new MessageController();
        const message: Message = { message: 'Error message', type: 'error' };
        expect(controller.getURL(message)?.link).toBe(TROUBLESHOOTING_URL);
      });

      it('when specified', () => {
        const controller = new MessageController();
        const url: MessageURL = {
          link: "link",
          title: "title"
        }
        const message: Message = {
          message: 'Error message',
          type: 'error',
          url
        };
        expect(controller.getURL(message)).toBe(url);
      });
    });
  });

  describe('should get context strings', () => {
    it('for no context', () => {
      const controller = new MessageController();
      const message: Message = {
        message: 'Message',
        type: 'info',
      };
      expect(controller.getContextStrings(message)).toEqual([]);
    });

    it('for simple string', () => {
      const controller = new MessageController();
      const message: Message = {
        message: 'Message',
        context: 'Context',
        type: 'info',
      };
      expect(controller.getContextStrings(message)).toEqual(['Context']);
    });

    it('for object', () => {
      const controller = new MessageController();
      const obj = { one: 1, two: 2 };
      const message: Message = {
        message: 'Message',
        context: obj,
        type: 'info',
      };
      expect(controller.getContextStrings(message)).toEqual([yaml.dump(obj)]);
    });

    it('for array', () => {
      const controller = new MessageController();
      const array = ['one', 'two'];
      const message: Message = {
        message: 'Message',
        context: array,
        type: 'info',
      };
      expect(controller.getContextStrings(message)).toEqual(
        array.map((item) => yaml.dump(item)),
      );
    });
  });
});
