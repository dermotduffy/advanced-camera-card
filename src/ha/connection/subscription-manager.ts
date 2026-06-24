import type { Connection } from 'home-assistant-js-websocket';

import {
  KeyedSubscriptionManager,
  type GetKeyCallback,
} from '../../utils/concurrency/keyed-subscription-manager';
import { RetryTimer } from '../../utils/retry-timer';
import { isHassReady } from '../is-hass-ready';
import type { HASSSource, HASSUnlistenCallback } from '../source';
import type { HomeAssistant } from '../types';
import type { HASSWebSocketLiveness, HASSWebSocketOpenCallback } from './types';

const RETRY_BASE_SECONDS = 1;
const RETRY_MAX_SECONDS = 300;

/**
 * Lifecycle status reported back to subscribers via their optional
 * `statusCallback` at `subscribe` time. The manager owns the retry policy;
 * consumers are pure observers that translate state changes into whatever they
 * want (an Issue/notification, a log, nothing). Consumers never call
 * `subscribe` again to retry -- they use `retry(request)` which routes through
 * the same state machine.
 */
export interface HASSWebSocketSubscriptionStatus<K, R> {
  key: K;
  request: R;

  // The subscription's lifecycle state:
  //  - `waiting`: not subscribed (e.g. HA isn't ready yet, submission in flight).
  //  - `subscribed`: the underlying WS subscription is live.
  //  - `failing`: the most recent attempt rejected. A retry is armed; the next
  //    status will be `waiting` then either `subscribed` or `failing` again.
  //  - `unsubscribed`: the request was removed via `unsubscribe()`.
  state: 'subscribed' | 'failing' | 'waiting' | 'unsubscribed';

  // Present only on `failing`: the rejection reason, and the total
  // failed-attempts count so far.
  error?: unknown;
  failureCount?: number;
}

export type HASSWebSocketStatusCallback<K, R> = (
  status: HASSWebSocketSubscriptionStatus<K, R>,
) => void;

interface RequestRegistration<K, R> {
  openCallback: HASSWebSocketOpenCallback;
  statusCallback: HASSWebSocketStatusCallback<K, R> | null;

  // Era-local, reset on every era boundary (see the class docs for "era").
  //
  // `token` tags the latest subscribe attempt so a newer attempt can replace
  // old/slow attempts; null when none is in flight.
  token: symbol | null;

  // `retry` schedules the next attempt after a failed subscribe; exponential
  // backoff spaces attempts out across HASS pushes.
  retry: RetryTimer;
}

/**
 * Manages subscriptions whose lifetime is bound to a HASS WebSocket
 * `Connection`. Layered on top of `KeyedSubscriptionManager` (KSM: per-key
 * refcount + sub/unsub serialization within ONE connection era).
 *
 * An **era** is a contiguous window during which the manager is bound to a
 * single live `Connection`. The KSM instance is replaced and each request's
 * era-local state (`token` + `retry`) is reset on every era boundary. The
 * durable `_requests` mirror is preserved across eras and drives replay.
 *  - Era STARTS when: a ready HASS arrives for the first time, OR the
 *    `Connection` object swaps to a different instance, OR the manager
 *    transitions from a not-ready dead era back to ready.
 *  - Era ENDS (becomes a dead era) when: HASS goes not-ready.
 *
 * Each era is identified by a `Symbol()` minted at era start and stored in
 * `_connectionEra`. The `HASSWebSocketLiveness` objects (returned to callers'
 * dispatch closures) capture the era symbol; their `isConnected()` method
 * compares the captured symbol against the manager's current `_connectionEra`.
 * Nulling or replacing `_connectionEra` therefore synchronously flips every
 * outstanding state to disconnected.
 *
 * Symbol identity (not `Connection` pointer identity) is what defines an era,
 * because the HA `Connection` library can reuse the same `Connection` object
 * across reconnect cycles. From the manager's standpoint a not-ready -> ready
 * transition with the same `Connection` is a NEW era (we've torn down era state
 * during not-ready), and we need old states to keep reporting disconnected even
 * if the pointer matches.
 *
 * Adds on top of KSM:
 *  - Deferred submit until HASS is ready.
 *  - Era boundaries as described above.
 *  - `HASSWebSocketLiveness` for caller dispatch callbacks: drops events that
 *    arrived from an era that's no longer current.
 *  - Time-spaced exponential-backoff retries on subscribe failure. Retries fire
 *    on a per-request `Timer`, NOT on HASS-push cadence (which is far too
 *    frequent). After many failures, retries naturally space out to the
 *    `RETRY_MAX_SECONDS` ceiling.
 *  - Lazy source attach / detach driven by request count.
 */
export class HASSConnectionSubscriptionManager<K, R> {
  private readonly _source: HASSSource;
  private readonly _getKeyCallback: GetKeyCallback<R, K>;

  private _connection: Connection | null = null;
  private _connectionEra: symbol | null = null;

  // Per-key refcount + sub/unsub serialization for the CURRENT era only.
  // Replaced with a fresh instance on every era boundary; the abandoned
  // instance's pending tasks resolve into an unreachable object.
  private _ksm: KeyedSubscriptionManager<K, R>;

  // Durable: source-of-truth list of currently-registered requests (with their
  // era-local token + retry). Survives era transitions and drives replay
  // against the new era's `KeyedSubscriptionManager`. The
  // `KeyedSubscriptionManager`'s internal request list lags behind by the time
  // of its async task; this mirror is updated synchronously on
  // subscribe/unsubscribe.
  private _requests = new Map<R, RequestRegistration<K, R>>();

  private _unlistenCallback: HASSUnlistenCallback | null = null;

  constructor(getKeyCallback: GetKeyCallback<R, K>, source: HASSSource) {
    this._getKeyCallback = getKeyCallback;
    this._source = source;
    this._ksm = this._createEmptyKSM();
  }

  public subscribe(
    request: R,
    openCallback: HASSWebSocketOpenCallback,
    statusCallback?: HASSWebSocketStatusCallback<K, R>,
  ): void {
    const wasEmpty = this._requests.size === 0;

    const registration: RequestRegistration<K, R> = {
      openCallback,
      statusCallback: statusCallback ?? null,
      token: null,
      retry: new RetryTimer({
        baseSeconds: RETRY_BASE_SECONDS,
        maxSeconds: RETRY_MAX_SECONDS,
      }),
    };
    this._requests.set(request, registration);

    if (wasEmpty) {
      this._listenToHASS();
    }

    if (this._connection && !registration.token) {
      this._submit(this._connection, request, registration);
    } else if (!this._connection) {
      // Dead era. Caller observes the request as waiting until the era starts
      // and `_submit` fires, at which point status flips to `subscribed` or
      // `failing`.
      this._emitStatus(request, 'waiting');
    }
  }

  public retry(request: R): void {
    const registration = this._requests.get(request);
    if (!registration) {
      return;
    }
    registration.retry.reset();
    if (this._connection) {
      this._submit(this._connection, request, registration);
    }
  }

  public unsubscribe(request: R): void {
    const registration = this._requests.get(request);
    if (!registration) {
      return;
    }
    this._emitStatus(request, 'unsubscribed');
    registration.retry.cancel();
    this._requests.delete(request);

    // `KeyedSubscriptionManager` unsubscribe failures are internal (HA returned
    // an error on the close message). Caller can't act; swallow.
    this._ksm.unsubscribe(request).catch(() => {});

    if (this._requests.size === 0) {
      this._unlistenFromHASS();
    }
  }

  public destroy(): void {
    this._unlistenFromHASS();
    this._endEra();
    this._requests.clear();
  }

  public getRequestsForKey(key: K): R[] {
    const result: R[] = [];
    for (const request of this._requests.keys()) {
      if (this._getKeyCallback(request) === key) {
        result.push(request);
      }
    }
    return result;
  }

  private _listenToHASS(): void {
    /* istanbul ignore if: only called when transitioning from zero to one
       request, so `_unlistenCallback` is always null here -- @preserve */
    if (this._unlistenCallback) {
      return;
    }
    this._unlistenCallback = this._source.addListener((hass) =>
      this._handleHASSChange(hass),
    );

    // Handle initial state.
    this._handleHASSChange(this._source.getHASS());
  }

  private _unlistenFromHASS(): void {
    if (!this._unlistenCallback) {
      return;
    }
    this._unlistenCallback();
    this._unlistenCallback = null;
  }

  private _handleHASSChange(hass: HomeAssistant | null): void {
    if (!hass || !isHassReady(hass)) {
      if (this._connectionEra !== null) {
        this._endEra();
        // Surface the era end to consumers so they can update any UI that was
        // reflecting `subscribed` or `failing` for the now-dead era.
        for (const request of this._requests.keys()) {
          this._emitStatus(request, 'waiting');
        }
      }
      return;
    }

    if (hass.connection === this._connection && this._connectionEra !== null) {
      // Nothing to do.
      return;
    }

    // Era transition (connection swap or reanimation from a dead era).
    this._endEra();
    this._connection = hass.connection;
    this._connectionEra = Symbol();

    for (const [request, registration] of this._requests) {
      this._submit(this._connection, request, registration);
    }
  }

  private _submit(
    connection: Connection,
    request: R,
    registration: RequestRegistration<K, R>,
  ): void {
    const token = Symbol();
    registration.token = token;
    registration.retry.cancel();

    const { openCallback } = registration;
    const liveness = this._createWebSocketLiveness();

    this._emitStatus(request, 'waiting');

    this._ksm
      .subscribe(request, () => openCallback(connection, liveness))
      .then(() => {
        const eraState = this._getCurrentEraState(request, token);
        if (!eraState) {
          return;
        }

        // Reset the backoff so the next failure (e.g. after an era swap)
        // starts at the base delay again instead of jumping to wherever we
        // had escalated to.
        eraState.retry.reset();
        this._emitStatus(request, 'subscribed');
      })
      .catch((e) => {
        const eraState = this._getCurrentEraState(request, token);
        if (!eraState) {
          return;
        }

        eraState.token = null;
        eraState.retry.schedule(() => this._runScheduledRetry(request));
        this._emitStatus(request, 'failing', e, eraState.retry.getAttempts());
      });
  }

  private _runScheduledRetry(request: R): void {
    const registration = this._requests.get(request);

    /* istanbul ignore if: unsubscribe() and `_endEra()` both stop the timer
       before tearing down state, so by the time we get here the request is
       still alive and the era is still ready -- @preserve */
    if (!registration || !this._connection) {
      return;
    }

    /* istanbul ignore if: the timer can only fire while its token is null (set
       null by the catch that scheduled this timer) -- @preserve */
    if (registration.token != null) {
      return;
    }
    this._submit(this._connection, request, registration);
  }

  private _emitStatus(
    request: R,
    state: HASSWebSocketSubscriptionStatus<K, R>['state'],
    error?: unknown,
    failureCount?: number,
  ): void {
    const registration = this._requests.get(request);
    try {
      registration?.statusCallback?.({
        key: this._getKeyCallback(request),
        request,
        state,
        ...(error != null && { error }),
        ...(failureCount && { failureCount }),
      });
    } catch {
      // Swallowed: a buggy observer must not corrupt the state machine.
    }
  }

  // Returns the request's registration only while `token` is still its current
  // submission. A mismatch (or a removed request) means the era moved on or a
  // newer submission superseded this one, so the caller must leave all state
  // untouched.
  private _getCurrentEraState(
    request: R,
    token: symbol,
  ): RequestRegistration<K, R> | null {
    const registration = this._requests.get(request);
    return registration?.token === token ? registration : null;
  }

  // End the current era: drop the connection and clear the era symbol (so every
  // outstanding `HASSWebSocketLiveness.isConnected()` flips to disconnected),
  // reset each request's era-local state, and close + replace the KSM.
  // Subscriptions are closed via the durable `_requests` mirror because KSM's
  // own list lags pending subscribe tasks; per-request close failures are
  // swallowed (an abandoned/dead connection has no live socket to ack the
  // close).
  private _endEra(): void {
    this._connection = null;
    this._connectionEra = null;

    const ksm = this._ksm;
    this._ksm = this._createEmptyKSM();
    for (const [request, registration] of this._requests) {
      registration.retry.reset();
      registration.token = null;
      ksm.unsubscribe(request).catch(() => {});
    }
  }

  private _createWebSocketLiveness(): HASSWebSocketLiveness {
    // Capture the era at submit time. `isConnected` compares it against the
    // manager's current era; if they differ, the manager has moved on and the
    // liveness reports disconnected. Arrow form so `this` is the class
    // instance.
    const era = this._connectionEra;
    return {
      isConnected: (): boolean => era !== null && this._connectionEra === era,
    };
  }

  private _createEmptyKSM(): KeyedSubscriptionManager<K, R> {
    return new KeyedSubscriptionManager<K, R>(this._getKeyCallback);
  }
}
