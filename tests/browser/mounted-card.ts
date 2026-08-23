import { expect, onTestFinished, vi } from 'vitest';

import type { AdvancedCameraCard } from '../../src/card';
import type { RawAdvancedCameraCardConfig } from '../../src/config/types';
import { ACTION_HANDLER_HOLD_SECONDS } from '../../src/const';
import { clickElement, deepQuery, deepQueryAll, getAllShadowRoots } from './dom';
import type { FakeEntityOptions, FakeHASS } from './fake-hass';
import { defineHAElementStubs } from './ha-element-stubs';

// Home Assistant's masonry columns are `max-width: 500px`, so this is the width
// a card usually gets. The card derives height from the media it is showing.
const DEFAULT_CONTAINER_WIDTH = '500px';

// Everything a rendered element can arrive as: drawn, moved, retitled or
// relabelled.
const RENDER_MUTATIONS = {
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
};

/**
 * Provides debug information when a test ends (e.g. timeout), by reporting
 * expected things that didn't happen. Helps narrow down a hanging test to the
 * precise unmet expectation.
 */
const reportIfNeverHappens = (
  description: string,
  cleanUp?: () => void,
): (() => void) => {
  let happened = false;

  onTestFinished(() => {
    cleanUp?.();

    if (!happened) {
      throw new Error(`Never happened: ${description}`);
    }
  });

  return () => {
    happened = true;
  };
};

/**
 * Wait for something the card draws.
 *
 * A `MutationObserver` reports a change when it happens and has no clock of its
 * own to run (so no clash with fake vs real timers used elsewhere in the test).
 * Alternatives on offer (e.g. `vi.waitFor`, `expect.element`) poll a timer,
 * which under a fake clock is the card's timer so each each poll advances the
 * card's own test clock by the interval between polls.
 *
 * If the predicate is never "found", the test will fail on the Vitest timeout,
 * which names only the test. `description` is reported alongside it, to say
 * which wait it was that never finished.
 *
 * Known limitation: the browser reports changes within a root being watched,
 * never the creation of a root itself. A new root is picked up because whatever
 * created it also changed a watched root; one created with nothing else
 * changing around it would be missed until the timeout. Everything the card
 * draws is a LIT element, which creates its root as the element is added to the
 * page, so the root above it always changes at the same moment and nothing is
 * missed.
 */
const waitForRender = async <T>(
  root: Element,
  find: () => T | null,
  description: string,
): Promise<T> => {
  const observers: MutationObserver[] = [];
  const observed = new Set<Node>();
  const stopObserving = (): void =>
    observers.forEach((observer) => observer.disconnect());

  const happened = reportIfNeverHappens(description, stopObserving);

  try {
    return await new Promise<T>((resolve) => {
      const check = (): void => {
        // Watch all shadow roots we're not already watching.
        for (const node of [root, ...getAllShadowRoots(root)]) {
          if (!observed.has(node)) {
            observed.add(node);

            const observer = new MutationObserver(check);
            observer.observe(node, RENDER_MUTATIONS);
            observers.push(observer);
          }
        }

        // Attempt to find.
        const match = find();
        if (match) {
          happened();
          resolve(match);
        }
      };

      check();
    });
  } finally {
    stopObserving();
  }
};

// The card events worth recording by default. There is no way to listen for a
// prefix, so every name a ledger reports has to be named somewhere; this is the
// set that describes what the card is doing rather than what an editor control
// was asked to do.
const DEFAULT_LEDGER_EVENTS = [
  'advanced-camera-card:action:execution-request',
  'advanced-camera-card:issue:notify',
  'advanced-camera-card:issue:resolve',
  'advanced-camera-card:issue:trigger',
  'advanced-camera-card:live:error',
  'advanced-camera-card:media:loaded',
  'advanced-camera-card:media:pause',
  'advanced-camera-card:media:play',
  'advanced-camera-card:media:volumechange',
  'advanced-camera-card:zoom:change',
  'advanced-camera-card:zoom:unzoomed',
  'advanced-camera-card:zoom:zoomed',
];

interface ConsoleEntry {
  level: ConsoleLevel;
  args: unknown[];
}

interface ConsoleWaiter {
  // The number of occurrences required to satisfy this waiter.
  count: number;
  level: ConsoleLevel;
  message: RegExp;
  resolve: () => void;
}

interface ConsoleWaiterOptions {
  count?: number;
  level?: ConsoleLevel;
}

const CONSOLE_LEVELS = ['debug', 'error', 'info', 'log', 'warn'] as const;
type ConsoleLevel = (typeof CONSOLE_LEVELS)[number];

interface EventWaiter {
  // The number of occurrences required to satisfy this waiter.
  count: number;
  resolve: (entry: EventEntry) => void;
}

interface EventEntry {
  type: string;
  detail: unknown;
  target: EventTarget | null;
}

interface LabeledElement extends Element {
  label?: string;
}

const hasLabel = (element: Element): element is LabeledElement => 'label' in element;

/**
 * What a control calls itself to the user. The card titles the controls it
 * draws itself. A menu button is Home Assistant's `ha-icon-button`, which takes
 * a `label` and renders the title onto a button within its own shadow root, so
 * the name that is reachable from outside is 'label' not 'title'.
 */
const getControlName = (element: Element): string | null => {
  const title = element.getAttribute('title');
  return title ? title : hasLabel(element) ? element.label ?? null : null;
};

/**
 * Records the card events named at construction.
 */
class EventLedger {
  private _entries: EventEntry[] = [];
  private _target: EventTarget;
  private _types: string[];

  private _waiting = new Map<string, EventWaiter[]>();

  private _handler = (ev: Event): void => {
    const entry: EventEntry = {
      type: ev.type,
      detail: ev instanceof CustomEvent ? ev.detail : null,
      target: ev.target,
    };
    this._entries.push(entry);

    const seen = this.getEntries(ev.type).length;
    const stillWaiting: EventWaiter[] = [];
    for (const waiter of this._waiting.get(ev.type) ?? []) {
      if (waiter.count <= seen) {
        waiter.resolve(entry);
      } else {
        stillWaiting.push(waiter);
      }
    }
    this._waiting.set(ev.type, stillWaiting);
  };

  constructor(target: EventTarget, types: string[]) {
    this._target = target;
    this._types = types;

    for (const type of types) {
      target.addEventListener(type, this._handler);
    }
  }

  public getEntries(type?: string): EventEntry[] {
    return type ? this._entries.filter((entry) => entry.type === type) : this._entries;
  }

  public async waitForFirst(type: string): Promise<EventEntry> {
    return await this.waitForCount(type, 1);
  }

  public async waitForNext(type: string): Promise<EventEntry> {
    return await this.waitForCount(type, this.getEntries(type).length + 1);
  }

  public async waitForCount(type: string, count: number): Promise<EventEntry> {
    if (!this._types.includes(type)) {
      throw new Error(`The event ledger is not recording: ${type}`);
    }

    const recorded = this.getEntries(type);
    if (recorded.length >= count) {
      return recorded[count - 1];
    }

    const happened = reportIfNeverHappens(`${type} firing ${count} time(s)`);

    return await new Promise<EventEntry>((resolve) => {
      this._waiting.set(type, [
        ...(this._waiting.get(type) ?? []),
        {
          count,
          resolve: (entry: EventEntry): void => {
            happened();
            resolve(entry);
          },
        },
      ]);
    });
  }

  public destroy(): void {
    for (const type of this._types) {
      this._target.removeEventListener(type, this._handler);
    }
    this._entries = [];
    this._waiting.clear();
  }
}

/**
 * Records what the card writes to the console.
 *
 * Some of what the card reports is only ever visible there: `errorToConsole`
 * is the sole outlet for many failures, and a `log` action writes its message
 * directly. Absence matters as much as presence, since a pair of outcomes that
 * look identical in the DOM can differ only in what was logged.
 */
class ConsoleLedger {
  private _entries: ConsoleEntry[] = [];
  private _originals = new Map<ConsoleLevel, (...args: unknown[]) => void>();

  private _waiting: ConsoleWaiter[] = [];

  constructor() {
    for (const level of CONSOLE_LEVELS) {
      const original = console[level];
      this._originals.set(level, original);
      console[level] = (...args: unknown[]): void => {
        this._entries.push({ level, args });
        this._resolveWaiters();
        original(...args);
      };
    }
  }

  public getEntries(level?: ConsoleLevel): ConsoleEntry[] {
    return level
      ? this._entries.filter((entry) => entry.level === level)
      : this._entries;
  }

  public getMessages(level?: ConsoleLevel): string[] {
    return this.getEntries(level).map((entry) => entry.args.map(String).join(' '));
  }

  public countMessages(message: RegExp, level: ConsoleLevel = 'info'): number {
    return this.getMessages(level).filter((written) => message.test(written)).length;
  }

  /**
   * Wait until a message has been written. The card acts on what a test does to
   * it without waiting to be asked, so a test that presses a key and reads the
   * log on the next line usually finds nothing there yet.
   */
  public async waitForMessage(
    message: RegExp,
    options?: ConsoleWaiterOptions,
  ): Promise<void> {
    const waiter = {
      count: options?.count ?? 1,
      level: options?.level ?? 'info',
      message,
    };

    if (this._isSatisfied(waiter)) {
      return;
    }

    const happened = reportIfNeverHappens(
      `${waiter.level} being written ${waiter.count} time(s): ${message.source}`,
    );

    return await new Promise<void>((resolve) => {
      this._waiting.push({
        ...waiter,
        resolve: (): void => {
          happened();
          resolve();
        },
      });
    });
  }

  private _isSatisfied(waiter: Omit<ConsoleWaiter, 'resolve'>): boolean {
    return this.countMessages(waiter.message, waiter.level) >= waiter.count;
  }

  private _resolveWaiters(): void {
    this._waiting = this._waiting.filter((waiter) => {
      if (!this._isSatisfied(waiter)) {
        return true;
      }
      waiter.resolve();
      return false;
    });
  }

  public destroy(): void {
    for (const [level, original] of this._originals) {
      console[level] = original;
    }
    this._originals.clear();
    this._entries = [];
    this._waiting = [];
  }
}

export interface MountOptions {
  // Event names to record alongside `DEFAULT_LEDGER_EVENTS`, for a test
  // interested in something those do not name.
  ledgerEvents?: string[];

  // The container the card is mounted in, standing in for a dashboard column.
  // Set these to put the card in a box of a particular size, for a test about
  // how it responds to the room it is given.
  width?: string;
  height?: string;

  // The element the container is created as, for a test about behavior the card
  // offers only *within* a particular Home Assistant element (e.g. its card
  // edit dialog, which the card looks for among its ancestors).
  containerTagName?: string;

  // Where that container is placed, as CSS lengths from the page's top left
  // corner. The page grows to reach it, so a card put beyond the window can
  // only be brought into view by scrolling.
  position?: { top?: string; left?: string };

  // Console errors required to be logged.
  expectedConsoleErrors?: RegExp[];

  // Console errors to allow without limit. Reserve this for errors whose number
  // is not the card's to control (e.g. the browsers).
  toleratedConsoleErrors?: RegExp[];
}

/**
 * A card in the document, driven by a `FakeHASS`, with the observers a test
 * needs to watch what it does.
 */
export class MountedCard {
  public readonly card: AdvancedCameraCard;
  public readonly events: EventLedger;
  public readonly console: ConsoleLedger;

  private _container: HTMLElement;
  private _hass: FakeHASS;
  private _expectedConsoleErrors: RegExp[];
  private _toleratedConsoleErrors: RegExp[];

  /**
   * The card is ready to observe but not yet rendered: initializing happens
   * after this returns, so a test waits for whatever it will assert on.
   *
   * `loadCard` puts the card's elements into the page. Where they come from is
   * the caller's to decide: `MountedCardFactory` takes them from `src/`, and the
   * suite covering a build ("dist") takes them from the file the build
   * produced.
   */
  public static async create(
    loadCard: () => Promise<unknown>,
    config: RawAdvancedCameraCardConfig,
    hass: FakeHASS,
    options?: MountOptions,
  ): Promise<MountedCard> {
    await loadCard();

    return new MountedCard(config, hass, options);
  }

  protected constructor(
    config: RawAdvancedCameraCardConfig,
    hass: FakeHASS,
    options?: MountOptions,
  ) {
    this._hass = hass;

    this._container = document.createElement(options?.containerTagName ?? 'div');
    this._container.style.width = options?.width ?? DEFAULT_CONTAINER_WIDTH;
    if (options?.height) {
      this._container.style.height = options.height;
    }
    if (options?.position) {
      this._container.style.position = 'absolute';
      this._container.style.top = options.position.top ?? '0';
      this._container.style.left = options.position.left ?? '0';
    }
    document.body.append(this._container);

    // Before the card exists, so that nothing it does during its first render is
    // missed.
    this.events = new EventLedger(this._container, [
      ...DEFAULT_LEDGER_EVENTS,
      ...(options?.ledgerEvents ?? []),
    ]);
    this.console = new ConsoleLedger();

    this.card = document.createElement('advanced-camera-card');
    this.card.setConfig(config);
    this.card.hass = hass.getHASS();

    this._container.append(this.card);

    this._expectedConsoleErrors = options?.expectedConsoleErrors ?? [];
    this._toleratedConsoleErrors = options?.toleratedConsoleErrors ?? [];

    onTestFinished(() => this._onTestFinished());
  }

  /**
   * Be certain of destruction, then hold the card to exactly the errors the test
   * said it would provoke. A card that reported a failure has not done what a
   * passing test says it did, and much of what it reports is visible nowhere
   * else. An expectation that stops matching is checked too, so a test cannot go
   * on claiming an error the card no longer produces.
   */
  private _onTestFinished(): void {
    // Read before destroying, which clears the ledger.
    const logged = this.console
      .getMessages('error')
      .filter(
        (message) =>
          !this._toleratedConsoleErrors.some((tolerated) => tolerated.test(message)),
      );

    this.destroy();

    // One error per expectation, in the order they were reported. Comparing the
    // whole array rather than searching it is what makes an expectation that
    // never matched, and an error logged more times than expected, both fail.
    expect(logged).toEqual(
      this._expectedConsoleErrors.map((expected) => expect.stringMatching(expected)),
    );
  }

  /**
   * Change an entity and hand the card the resulting `hass`. Both halves
   * together, because a state the card was never given changes nothing.
   */
  public setEntityState(entityID: string, state: FakeEntityOptions | string): void {
    this._hass.setState(entityID, state);
    this.card.hass = this._hass.getHASS();
  }

  /**
   * How many Home Assistant event subscriptions the card currently holds open.
   */
  public getOpenEventSubscriptionCount(): number {
    return this._hass.getOpenEventSubscriptionCount();
  }

  /**
   * Hand the card a new `hass` with nothing in it changed.
   */
  public renewHASS(): void {
    this._hass.renew();
    this.card.hass = this._hass.getHASS();
  }

  /**
   * Drop or restore the connection to Home Assistant, then hand the card the
   * resulting `hass`.
   */
  public setConnected(connected: boolean): void {
    this._hass.setConnected(connected);
    this.card.hass = this._hass.getHASS();
  }

  /**
   * Give the card a new configuration.
   */
  public setConfig(config: RawAdvancedCameraCardConfig): void {
    this.card.setConfig(config);
  }

  /**
   * Take the card off the page.
   */
  public detach(): void {
    this.card.remove();
  }

  /**
   * Put the card back on the page.
   */
  public attach(): void {
    this._container.append(this.card);
  }

  /**
   * Resolves once the card itself has rendered, which says nothing about the
   * elements beneath it.
   */
  public get updateComplete(): Promise<boolean> {
    return this.card.updateComplete;
  }

  /**
   * Move the card's clock on, then wait for the card itself to render.
   */
  public async advanceSeconds(seconds: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(seconds * 1000);
    await this.card.updateComplete;
  }

  /**
   * Wait for something the card has rendered, searching its shadow roots.
   */
  public async waitForSelector<T extends Element = Element>(
    selector: string,
  ): Promise<T> {
    return await this.waitForRender(
      () => deepQuery<T>(this.card, selector),
      `an element matching ${selector}`,
    );
  }

  /**
   * Wait for something the card renders that a selector cannot describe. Use
   * instead of `vi.waitFor` which interferes with fake `card` time.
   *
   * `description` names what is being waited for (so it can be displayed if not
   * found, for debugging purposes).
   */
  public async waitForRender<T>(find: () => T | null, description: string): Promise<T> {
    return await waitForRender(this.card, find, description);
  }

  /**
   * Click a control by the name the user sees on it, waiting for it to appear.
   */
  public async clickControl(name: string): Promise<void> {
    const control = await this._findControl(name);

    await clickElement(control);
  }

  /**
   * Press and keep holding a control until the card takes it as a hold, which
   * is a second action several controls carry alongside their tap.
   *
   * Assembled from events rather than driven with a real pointer, because
   * `userEvent` offers whole gestures only (click, hover, drag) and none of
   * them stops part way through a press.
   */
  public async holdControl(name: string): Promise<void> {
    const control = await this._findControl(name);

    // Composed as well as bubbling: a real press crosses the shadow boundaries
    // between a control and whatever is listening above it.
    const press = { bubbles: true, composed: true };
    control.dispatchEvent(new MouseEvent('mousedown', press));
    await vi.advanceTimersByTimeAsync(ACTION_HANDLER_HOLD_SECONDS * 1000);
    control.dispatchEvent(new MouseEvent('mouseup', press));

    // The card takes the click, not the mouseup, as the end of a press. A real
    // pointer sends both, in this order.
    control.click();
  }

  /**
   * Click the control that steps a carousel one item along.
   *
   * These carry the name of whatever they move to rather than a name of their
   * own, which several other controls also carry, so they are reached by the
   * side they sit on instead. Which side moves forward depends on the reading
   * direction of the page, exactly as it does for the user.
   */
  public async clickNextPreviousControl(side: 'left' | 'right'): Promise<void> {
    const control = await this.waitForRender(
      () => deepQuery<HTMLElement>(this.card, `ha-icon-button.controls.${side}`),
      `the ${side} carousel control`,
    );

    await clickElement(control);
  }

  private async _findControl(name: string): Promise<HTMLElement> {
    return await this.waitForRender(() => {
      const found = deepQueryAll(this.card, '*').find(
        (element) =>
          getControlName(element) === name &&
          // A control the user can press occupies space. An element that only
          // wraps one can carry the same name while having no box of its own.
          !!element.getBoundingClientRect().width,
      );
      return found instanceof HTMLElement ? found : null;
    }, `a control named ${name}`);
  }

  public destroy(): void {
    this.card.remove();
    this._container.remove();
    this.events.destroy();
    this.console.destroy();
  }
}

export class MountedCardFactory {
  // A card built from `src/`. Constrast with dist.browsers.test.ts .
  public static async createFromSource(
    config: RawAdvancedCameraCardConfig,
    hass: FakeHASS,
    options?: MountOptions,
  ): Promise<MountedCard> {
    return await MountedCard.create(
      async () => {
        // `src/patches` subclasses Home Assistant's three player elements as
        // soon as those are defined, so the stubs must come first.
        defineHAElementStubs();
        await import('../../src/card');
      },
      config,
      hass,
      options,
    );
  }
}
