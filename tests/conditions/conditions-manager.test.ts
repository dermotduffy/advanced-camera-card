import { afterEach, describe, expect, it, vi } from 'vitest';
import { MicrophoneState } from '../../src/card-controller/types';
import { ConditionsManager } from '../../src/conditions/conditions-manager';
import { ConditionStateManager } from '../../src/conditions/state-manager';
import {
  createConfig,
  createMediaLoadedInfo,
  createStateEntity,
  createUser,
} from '../test-utils';

// @vitest-environment jsdom
describe('ConditionsManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('should evaluate conditions', () => {
    describe('with a view condition', () => {
      it('should match named view change', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'view' as const, views: ['foo'] }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({ view: 'foo' });
        expect(manager.getEvaluation().result).toBeTruthy();
      });

      it('should match any view change', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'view' as const }],
          stateManager,
        );

        const listener = vi.fn();
        manager.addListener(listener);

        stateManager.setState({ view: 'clips' });
        expect(listener).toHaveBeenLastCalledWith({
          result: true,
          triggerData: {
            view: {
              to: 'clips',
            },
          },
        });

        stateManager.setState({ view: 'timeline' });
        expect(listener).toHaveBeenLastCalledWith({
          result: true,
          triggerData: {
            view: {
              from: 'clips',
              to: 'timeline',
            },
          },
        });

        expect(listener).toBeCalledTimes(2);
      });

      it('should not re-trigger without a real change', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'view' as const }],
          stateManager,
        );

        const listener = vi.fn();
        manager.addListener(listener);

        stateManager.setState({ view: 'clips' });
        expect(listener).toHaveBeenCalledTimes(1);

        stateManager.setState({ view: 'clips' });
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    it('with fullscreen condition', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true }],
        stateManager,
      );

      expect(manager.getEvaluation().result).toBeFalsy();
      stateManager.setState({ fullscreen: true });
      expect(manager.getEvaluation().result).toBeTruthy();
      stateManager.setState({ fullscreen: false });
      expect(manager.getEvaluation().result).toBeFalsy();
    });

    it('with expand condition', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'expand' as const, expand: true }],
        stateManager,
      );

      expect(manager.getEvaluation().result).toBeFalsy();
      stateManager.setState({ expand: true });
      expect(manager.getEvaluation().result).toBeTruthy();
      stateManager.setState({ expand: false });
      expect(manager.getEvaluation().result).toBeFalsy();
    });

    describe('with camera condition', () => {
      it('should match named camera change', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'camera' as const, cameras: ['bar'] }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({ camera: 'bar' });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({ camera: 'will-not-match' });
        expect(manager.getEvaluation().result).toBeFalsy();
      });

      it('should match any camera change', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'camera' as const }],
          stateManager,
        );

        const listener = vi.fn();
        manager.addListener(listener);

        stateManager.setState({ camera: 'bar' });
        expect(listener).toHaveBeenLastCalledWith({
          result: true,
          triggerData: {
            camera: {
              to: 'bar',
            },
          },
        });

        stateManager.setState({ camera: 'foo' });
        expect(listener).toHaveBeenLastCalledWith({
          result: true,
          triggerData: {
            camera: {
              from: 'bar',
              to: 'foo',
            },
          },
        });

        expect(listener).toBeCalledTimes(2);
      });

      it('should not re-trigger without a real change', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'camera' as const }],
          stateManager,
        );

        const listener = vi.fn();
        manager.addListener(listener);

        stateManager.setState({ camera: 'bar' });
        expect(listener).toHaveBeenCalledTimes(1);

        stateManager.setState({ camera: 'bar' });
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe('with stock HA conditions', () => {
      describe('with state condition', () => {
        it('neither positive nor negative', () => {
          const stateManager = new ConditionStateManager();
          const manager = new ConditionsManager(
            [
              {
                condition: 'state' as const,
                entity: 'binary_sensor.foo',
              },
            ],
            stateManager,
          );
          const listener = vi.fn();
          manager.addListener(listener);

          stateManager.setState({
            state: { 'binary_sensor.foo': createStateEntity({ state: 'on' }) },
          });
          expect(listener).toBeCalledWith({
            result: true,
            triggerData: {
              state: {
                entity: 'binary_sensor.foo',
                to: 'on',
              },
            },
          });
          expect(listener).toBeCalledTimes(1);

          stateManager.setState({
            state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
          });
          expect(listener).toBeCalledWith({
            result: true,
            triggerData: {
              state: {
                entity: 'binary_sensor.foo',
                from: 'on',
                to: 'off',
              },
            },
          });
          expect(listener).toBeCalledTimes(2);
        });

        describe('positive', () => {
          it('single state', () => {
            const stateManager = new ConditionStateManager();
            const manager = new ConditionsManager(
              [
                {
                  condition: 'state' as const,
                  entity: 'binary_sensor.foo',
                  state: 'on',
                },
              ],
              stateManager,
            );

            expect(manager.getEvaluation().result).toBeFalsy();
            stateManager.setState({
              state: { 'binary_sensor.foo': createStateEntity() },
            });
            expect(manager.getEvaluation().result).toBeTruthy();
            stateManager.setState({
              state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
            });
            expect(manager.getEvaluation().result).toBeFalsy();
          });

          it('multiple states', () => {
            const stateManager = new ConditionStateManager();
            const manager = new ConditionsManager(
              [
                {
                  condition: 'state' as const,
                  entity: 'binary_sensor.foo',
                  state: ['active', 'on'],
                },
              ],
              stateManager,
            );

            expect(manager.getEvaluation().result).toBeFalsy();
            stateManager.setState({
              state: { 'binary_sensor.foo': createStateEntity() },
            });
            expect(manager.getEvaluation().result).toBeTruthy();
            stateManager.setState({
              state: { 'binary_sensor.foo': createStateEntity({ state: 'active' }) },
            });
            expect(manager.getEvaluation().result).toBeTruthy();
            stateManager.setState({
              state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
            });
            expect(manager.getEvaluation().result).toBeFalsy();
          });
        });

        describe('negative', () => {
          it('single state', () => {
            const stateManager = new ConditionStateManager();
            const manager = new ConditionsManager(
              [
                {
                  condition: 'state' as const,
                  entity: 'binary_sensor.foo',
                  state_not: 'on',
                },
              ],
              stateManager,
            );

            expect(manager.getEvaluation().result).toBeFalsy();
            stateManager.setState({
              state: { 'binary_sensor.foo': createStateEntity() },
            });
            expect(manager.getEvaluation().result).toBeFalsy();
            stateManager.setState({
              state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
            });
            expect(manager.getEvaluation().result).toBeTruthy();
          });
        });

        it('multiple states', () => {
          const stateManager = new ConditionStateManager();
          const manager = new ConditionsManager(
            [
              {
                condition: 'state' as const,
                entity: 'binary_sensor.foo',
                state_not: ['active', 'on'],
              },
            ],
            stateManager,
          );

          expect(manager.getEvaluation().result).toBeFalsy();
          stateManager.setState({ state: { 'binary_sensor.foo': createStateEntity() } });
          expect(manager.getEvaluation().result).toBeFalsy();
          stateManager.setState({
            state: { 'binary_sensor.foo': createStateEntity({ state: 'active' }) },
          });
          expect(manager.getEvaluation().result).toBeFalsy();
          stateManager.setState({
            state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
          });
          expect(manager.getEvaluation().result).toBeTruthy();
        });

        it('implicit state condition', () => {
          const stateManager = new ConditionStateManager();
          const manager = new ConditionsManager(
            [
              {
                entity: 'binary_sensor.foo',
                state: 'on',
              },
            ],
            stateManager,
          );

          expect(manager.getEvaluation().result).toBeFalsy();
          stateManager.setState({ state: { 'binary_sensor.foo': createStateEntity() } });
          expect(manager.getEvaluation().result).toBeTruthy();
          stateManager.setState({
            state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
          });
          expect(manager.getEvaluation().result).toBeFalsy();
        });

        it('should match any state change when state and state_not omitted', () => {
          const stateManager = new ConditionStateManager();
          const manager = new ConditionsManager(
            [
              { condition: 'state' as const, entity: 'switch.one' },
              { condition: 'state' as const, entity: 'switch.two' },
            ],
            stateManager,
          );

          const listener = vi.fn();
          manager.addListener(listener);

          stateManager.setState({
            state: {
              'switch.one': createStateEntity({ state: 'on' }),
              'switch.two': createStateEntity({ state: 'off' }),
            },
          });
          expect(listener).toHaveBeenLastCalledWith({
            result: true,
            triggerData: {
              // Only the last matching state will be included in the data.
              state: {
                entity: 'switch.two',
                to: 'off',
              },
            },
          });

          stateManager.setState({
            state: {
              'switch.one': createStateEntity({ state: 'off' }),
              'switch.two': createStateEntity({ state: 'on' }),
            },
          });

          expect(listener).toHaveBeenLastCalledWith({
            result: true,
            triggerData: {
              // Only the last matching state will be included in the data.
              state: {
                entity: 'switch.two',
                from: 'off',
                to: 'on',
              },
            },
          });

          expect(listener).toBeCalledTimes(2);
        });

        it('should not re-trigger without a real change', () => {
          const stateManager = new ConditionStateManager();
          const manager = new ConditionsManager(
            [{ condition: 'state' as const, entity: 'switch.one' }],
            stateManager,
          );

          const listener = vi.fn();
          manager.addListener(listener);

          stateManager.setState({
            state: {
              'switch.one': createStateEntity({ state: 'on' }),
            },
          });
          expect(listener).toBeCalledTimes(1);
          expect(manager.getEvaluation()).toEqual({
            result: true,
            triggerData: {
              // Only the last matching state will be included in the data.
              state: {
                entity: 'switch.one',
                to: 'on',
              },
            },
          });

          stateManager.setState({
            state: {
              'switch.one': createStateEntity({ state: 'on' }),
            },
          });
          expect(listener).toBeCalledTimes(1);
        });
      });

      describe('with numeric state condition', () => {
        it('above', () => {
          const stateManager = new ConditionStateManager();
          const manager = new ConditionsManager(
            [
              {
                condition: 'numeric_state' as const,
                entity: 'sensor.foo',
                above: 10,
              },
            ],
            stateManager,
          );

          expect(manager.getEvaluation().result).toBeFalsy();
          stateManager.setState({
            state: { 'sensor.foo': createStateEntity({ state: '11' }) },
          });
          expect(manager.getEvaluation().result).toBeTruthy();
          stateManager.setState({
            state: { 'binary_sensor.foo': createStateEntity({ state: '9' }) },
          });
          expect(manager.getEvaluation().result).toBeFalsy();
        });

        it('below', () => {
          const stateManager = new ConditionStateManager();
          const manager = new ConditionsManager(
            [
              {
                condition: 'numeric_state' as const,
                entity: 'sensor.foo',
                below: 10,
              },
            ],
            stateManager,
          );

          expect(manager.getEvaluation().result).toBeFalsy();
          stateManager.setState({
            state: { 'sensor.foo': createStateEntity({ state: '11' }) },
          });
          expect(manager.getEvaluation().result).toBeFalsy();
          stateManager.setState({
            state: { 'sensor.foo': createStateEntity({ state: '9' }) },
          });
          expect(manager.getEvaluation().result).toBeTruthy();
        });
      });

      it('should not call listeners for HA state changes without relevant condition', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [
            {
              condition: 'fullscreen' as const,
              fullscreen: true,
            },
          ],
          stateManager,
        );

        const listener = vi.fn();
        manager.addListener(listener);

        stateManager.setState({
          state: { 'sensor.foo': createStateEntity({ state: '11' }) },
        });

        expect(listener).not.toBeCalled();
      });
    });

    it('with user condition', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [
          {
            condition: 'user' as const,
            users: ['user_1', 'user_2'],
          },
        ],
        stateManager,
      );

      expect(manager.getEvaluation().result).toBeFalsy();
      stateManager.setState({
        user: createUser({ id: 'user_1' }),
      });
      expect(manager.getEvaluation().result).toBeTruthy();
      stateManager.setState({
        user: createUser({ id: 'user_WRONG' }),
      });
      expect(manager.getEvaluation().result).toBeFalsy();
    });

    it('with media loaded condition', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'media_loaded' as const, media_loaded: true }],
        stateManager,
      );

      expect(manager.getEvaluation().result).toBeFalsy();
      stateManager.setState({ mediaLoadedInfo: createMediaLoadedInfo() });
      expect(manager.getEvaluation().result).toBeTruthy();
      stateManager.setState({ mediaLoadedInfo: null });
      expect(manager.getEvaluation().result).toBeFalsy();
    });

    describe('with screen condition', () => {
      it('on evaluation', () => {
        vi.spyOn(window, 'matchMedia')
          .mockReturnValueOnce({
            addEventListener: vi.fn(),
          } as unknown as MediaQueryList)
          .mockReturnValueOnce({
            matches: true,
          } as unknown as MediaQueryList);

        const manager = new ConditionsManager([
          { condition: 'screen' as const, media_query: 'whatever' },
        ]);
        expect(manager.getEvaluation().result).toBeTruthy();
      });

      it('on trigger', () => {
        const addEventListener = vi.fn();
        const removeEventListener = vi.fn();
        vi.spyOn(window, 'matchMedia')
          .mockReturnValueOnce({
            addEventListener: addEventListener,
            removeEventListener: removeEventListener,
          } as unknown as MediaQueryList)
          .mockReturnValueOnce({
            matches: false,
          } as unknown as MediaQueryList)
          .mockReturnValueOnce({
            matches: true,
          } as unknown as MediaQueryList);

        const manager = new ConditionsManager([
          {
            condition: 'screen' as const,
            media_query: 'media query goes here',
          },
        ]);

        expect(addEventListener).toHaveBeenCalledWith('change', expect.anything());

        const callback = vi.fn();
        manager.addListener(callback);

        // Call the media query callback and use it to pretend a match happened. The
        // callback is the 0th mock innvocation and the 1st argument.
        addEventListener.mock.calls[0][1]();

        // This should result in a callback to our state listener.
        expect(callback).toBeCalledWith({ result: true, triggerData: {} });

        // Destroy the manager and ensure the event listener is removed.
        manager.destroy();
        expect(removeEventListener).toBeCalled();
      });
    });

    it('with display mode condition', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'display_mode' as const, display_mode: 'grid' as const }],
        stateManager,
      );

      expect(manager.getEvaluation().result).toBeFalsy();
      stateManager.setState({ displayMode: 'grid' });
      expect(manager.getEvaluation().result).toBeTruthy();
      stateManager.setState({ displayMode: 'single' });
      expect(manager.getEvaluation().result).toBeFalsy();
    });

    it('with triggered condition', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'triggered' as const, triggered: ['camera_1', 'camera_2'] }],
        stateManager,
      );

      expect(manager.getEvaluation().result).toBeFalsy();
      stateManager.setState({ triggered: new Set(['camera_1']) });
      expect(manager.getEvaluation().result).toBeTruthy();
      stateManager.setState({
        triggered: new Set(['camera_2', 'camera_1', 'camera_3']),
      });
      expect(manager.getEvaluation().result).toBeTruthy();
      stateManager.setState({ triggered: new Set(['camera_3']) });
      expect(manager.getEvaluation().result).toBeFalsy();
    });

    it('with interaction condition', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'interaction' as const, interaction: true }],
        stateManager,
      );

      expect(manager.getEvaluation().result).toBeFalsy();
      stateManager.setState({ interaction: true });
      expect(manager.getEvaluation().result).toBeTruthy();
      stateManager.setState({ interaction: false });
      expect(manager.getEvaluation().result).toBeFalsy();
    });

    describe('with microphone condition', () => {
      const createMicrophoneState = (
        state: Partial<MicrophoneState>,
      ): MicrophoneState => {
        return {
          connected: false,
          muted: false,
          forbidden: false,
          ...state,
        };
      };
      it('empty', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'microphone' as const }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({
          microphone: createMicrophoneState({ connected: true }),
        });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({
          microphone: createMicrophoneState({ connected: false }),
        });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({ microphone: createMicrophoneState({ muted: true }) });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({ microphone: createMicrophoneState({ muted: false }) });
        expect(manager.getEvaluation().result).toBeTruthy();
      });

      it('connected is true', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'microphone' as const, connected: true }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          microphone: createMicrophoneState({ connected: true }),
        });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({
          microphone: createMicrophoneState({ connected: false }),
        });
        expect(manager.getEvaluation().result).toBeFalsy();
      });

      it('connected is false', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'microphone' as const, connected: false }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          microphone: createMicrophoneState({ connected: true }),
        });
        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          microphone: createMicrophoneState({ connected: false }),
        });
        expect(manager.getEvaluation().result).toBeTruthy();
      });

      it('muted is true', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'microphone' as const, muted: true }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({ microphone: createMicrophoneState({ muted: true }) });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({ microphone: createMicrophoneState({ muted: false }) });
        expect(manager.getEvaluation().result).toBeFalsy();
      });

      it('muted is false', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'microphone' as const, muted: false }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({ microphone: createMicrophoneState({ muted: true }) });
        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({ microphone: createMicrophoneState({ muted: false }) });
        expect(manager.getEvaluation().result).toBeTruthy();
      });

      it('connected and muted', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'microphone' as const, muted: false, connected: true }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({ microphone: createMicrophoneState({ muted: true }) });
        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({ microphone: createMicrophoneState({ muted: false }) });
        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          microphone: createMicrophoneState({ connected: false, muted: false }),
        });
        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          microphone: createMicrophoneState({ connected: true, muted: false }),
        });
        expect(manager.getEvaluation().result).toBeTruthy();
      });
    });

    describe('with key condition', () => {
      it('simple keypress', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'key' as const, key: 'a' }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          keys: {
            a: { state: 'down', ctrl: false, shift: false, alt: false, meta: false },
          },
        });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({
          keys: {
            a: { state: 'up', ctrl: false, shift: false, alt: false, meta: false },
          },
        });

        expect(manager.getEvaluation().result).toBeFalsy();
      });

      it('keypress with modifiers', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [
            {
              condition: 'key' as const,
              key: 'a',
              state: 'down' as const,
              ctrl: true,
              shift: true,
              alt: true,
              meta: true,
            },
          ],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          keys: {
            a: { state: 'down', ctrl: false, shift: false, alt: false, meta: false },
          },
        });
        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          keys: {
            a: { state: 'down', ctrl: true, shift: true, alt: true, meta: false },
          },
        });
        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          keys: {
            a: { state: 'down', ctrl: true, shift: true, alt: true, meta: true },
          },
        });
        expect(manager.getEvaluation().result).toBeTruthy();
      });
    });

    describe('with user agent condition', () => {
      const userAgent =
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

      it('should match exact user agent', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'user_agent' as const, user_agent: userAgent }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          userAgent: userAgent,
        });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({
          userAgent: 'Something else',
        });
        expect(manager.getEvaluation().result).toBeFalsy();
      });

      it('should match user agent regex', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'user_agent' as const, user_agent_re: 'Chrome/' }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          userAgent: userAgent,
        });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({
          userAgent: 'Something else',
        });
        expect(manager.getEvaluation().result).toBeFalsy();
      });

      it('should match companion app', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'user_agent' as const, companion: true }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          userAgent: 'Home Assistant/',
        });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({
          userAgent: userAgent,
        });
        expect(manager.getEvaluation().result).toBeFalsy();
      });

      it('should match multiple parameters', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [
            {
              condition: 'user_agent' as const,
              companion: true,
              user_agent: 'Home Assistant/',
              user_agent_re: 'Home.Assistant',
            },
          ],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({
          userAgent: 'Home Assistant/',
        });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({
          userAgent: 'Something else',
        });
        expect(manager.getEvaluation().result).toBeFalsy();
      });
    });

    describe('with config condition', () => {
      const config_1 = createConfig({
        // Default is:
        //
        // view: {
        //   default: live,
        // },
      });
      const config_2 = createConfig({
        view: {
          default: 'clips',
        },
      });
      const config_3 = createConfig({
        view: {
          default: 'clips',
          default_cycle_camera: true,
        },
      });
      const config_4 = createConfig({
        view: {
          default: 'clips',
          default_cycle_camera: true,
          dim: true,
        },
      });

      it('should match any config change', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'config' as const }],
          stateManager,
        );

        const listener = vi.fn();
        manager.addListener(listener);

        stateManager.setState({ config: config_1 });
        expect(listener).toHaveBeenLastCalledWith({
          result: true,
          triggerData: {
            config: {
              to: config_1,
            },
          },
        });

        stateManager.setState({ config: config_2 });
        expect(listener).toHaveBeenLastCalledWith({
          result: true,
          triggerData: {
            config: {
              from: config_1,
              to: config_2,
            },
          },
        });

        expect(listener).toBeCalledTimes(2);
      });

      it('should match specific config change', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'config' as const, paths: ['view.default'] }],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({ config: config_1 });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({ config: config_2 });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({ config: config_3 });
        expect(manager.getEvaluation().result).toBeFalsy();
      });

      it('should match multiple config change', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [
            {
              condition: 'config' as const,
              paths: ['view.default', 'view.default_cycle_camera'],
            },
          ],
          stateManager,
        );

        expect(manager.getEvaluation().result).toBeFalsy();
        stateManager.setState({ config: config_1 });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({ config: config_2 });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({ config: config_3 });
        expect(manager.getEvaluation().result).toBeTruthy();
        stateManager.setState({ config: config_4 });
        expect(manager.getEvaluation().result).toBeFalsy();
      });

      it('should not match unrelated changes', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'config' as const }],
          stateManager,
        );

        const listener = vi.fn();
        manager.addListener(listener);

        stateManager.setState({ config: config_1 });
        expect(listener).toBeCalledTimes(1);

        // On the next state set, the condition won't match anymore (as the
        // config is the same), the listener will still be called to indicate
        // the condition evaluation has changed.
        stateManager.setState({ expand: true });
        expect(listener).toBeCalledTimes(2);
        expect(listener).toHaveBeenLastCalledWith({ result: false });

        // Future unrelated state changes won't call the listener.
        stateManager.setState({ fullscreen: true });
        expect(listener).toBeCalledTimes(2);
      });

      it('should not re-trigger without a real change', () => {
        const stateManager = new ConditionStateManager();
        const manager = new ConditionsManager(
          [{ condition: 'config' as const }],
          stateManager,
        );

        const listener = vi.fn();
        manager.addListener(listener);

        stateManager.setState({ config: config_1 });
        expect(listener).toHaveBeenCalledTimes(1);

        stateManager.setState({ config: config_1 });
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    it('with initialized condition', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'initialized' as const }],
        stateManager,
      );

      expect(manager.getEvaluation().result).toBeFalsy();
      stateManager.setState({ initialized: true });
      expect(manager.getEvaluation().result).toBeTruthy();
      stateManager.setState({ initialized: false });
      expect(manager.getEvaluation().result).toBeFalsy();
    });
  });

  describe('should handle listeners correctly', () => {
    it('should add listener', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true }],
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);

      stateManager.setState({ fullscreen: true });

      expect(listener).toBeCalledWith({ result: true, triggerData: {} });
      expect(listener).toBeCalledTimes(1);

      stateManager.setState({ fullscreen: false });
      expect(listener).toBeCalledWith({ result: false });
      expect(listener).toBeCalledTimes(2);

      // Re-add the same listener (will still only be called once).
      manager.addListener(listener);

      stateManager.setState({ fullscreen: true });

      expect(listener).toBeCalledWith({ result: true, triggerData: {} });
      expect(listener).toBeCalledTimes(3);
    });

    it('should remove listener', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true }],
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);
      manager.removeListener(listener);

      stateManager.setState({ fullscreen: true });

      expect(listener).not.toBeCalled();
    });

    it('should remove listener on destroy', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'fullscreen' as const, fullscreen: true }],
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);
      manager.destroy();

      stateManager.setState({ fullscreen: true });

      expect(listener).not.toBeCalled();
    });

    it('with not call listeners when condition result does not change', () => {
      const stateManager = new ConditionStateManager();
      const manager = new ConditionsManager(
        [{ condition: 'view' as const, views: ['foo'] }],
        stateManager,
      );

      const listener = vi.fn();
      manager.addListener(listener);

      stateManager.setState({ view: 'foo' });
      expect(listener).toBeCalledTimes(1);

      stateManager.setState({ view: 'bar' });
      expect(listener).toBeCalledTimes(2);

      stateManager.setState({ view: 'bar' });
      expect(listener).toBeCalledTimes(2);

      stateManager.setState({ view: 'foo' });
      expect(listener).toBeCalledTimes(3);

      stateManager.setState({ view: 'foo' });
      expect(listener).toBeCalledTimes(3);
    });
  });
});
