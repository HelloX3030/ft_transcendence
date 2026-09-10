import { Injectable, OnModuleInit } from '@nestjs/common';
import * as m from './metrics.definitions';

/** Outcome vocabularies, so a typo in a call site is a compile error. */
export type LoginOutcome =
  | 'success'
  | 'mfa_required'
  | 'bad_password'
  | 'unknown_account'
  | 'no_local_password';
export type MfaOutcome = 'success' | 'invalid_otp' | 'replayed_otp' | 'invalid_challenge';
export type RegistrationOutcome = 'success' | 'credentials_taken';
export type RefreshOutcome =
  | 'success'
  | 'graced'
  | 'stale_key'
  | 'unknown_session'
  | 'owner_mismatch'
  | 'expired_session';
export type PasswordResetStage =
  | 'requested'
  | 'unknown_account'
  | 'cooldown_blocked'
  | 'google_account'
  | 'mail_sent'
  | 'completed'
  | 'invalid_token';
export type GoogleLoginOutcome = 'success' | 'mfa_required' | 'provider_error';
export type CacheResult = 'hit' | 'miss' | 'error';
export type TmdbOutcome = 'success' | 'not_found' | 'upstream_error' | 'network_error';
export type RecommenderEndpoint = 'feed' | 'signal';
export type RecommenderOutcome = 'success' | 'http_error' | 'network_error';

/** Recorded when a request finished without ever matching a route template. */
const UNMATCHED_ROUTE = 'unmatched';

/**
 * The only thing in the app that touches prom-client, so instrumenting a service
 * costs it one constructor argument and one method call rather than a metric
 * definition and an import of the registry.
 *
 * Every method is deliberately failure-proof in the sense that it returns void
 * and throws nothing: a metric must never be able to fail the request it is
 * measuring.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  onModuleInit(): void {
    m.startDefaultMetrics();
  }

  /** The scrape body, in Prometheus' text exposition format. */
  render(): Promise<string> {
    return m.registry.metrics();
  }

  get contentType(): string {
    return m.registry.contentType;
  }

  /* ---------------------------------------------------------------- HTTP */

  /**
   * Marks a request as started and returns the function that closes it out.
   * `route` is supplied at the end rather than the start because Express only
   * attaches the matched route template once the handler has been selected.
   */
  startHttpRequest(method: string): (route: string | undefined, statusCode: number) => void {
    m.httpRequestsInFlight.inc({ method });
    const stopTimer = m.httpRequestDuration.startTimer();

    return (route, statusCode) => {
      m.httpRequestsInFlight.dec({ method });
      stopTimer({ method, route: route ?? UNMATCHED_ROUTE, status_code: String(statusCode) });
    };
  }

  /* ---------------------------------------------------------------- Auth */

  recordLogin(outcome: LoginOutcome): void {
    m.authLoginAttempts.inc({ outcome });
  }

  recordMfaVerification(outcome: MfaOutcome): void {
    m.authMfaVerifications.inc({ outcome });
  }

  recordRegistration(outcome: RegistrationOutcome): void {
    m.authRegistrations.inc({ outcome });
  }

  recordTokenRefresh(outcome: RefreshOutcome): void {
    m.authTokenRefreshes.inc({ outcome });
  }

  recordPasswordResetStage(stage: PasswordResetStage): void {
    m.authPasswordResets.inc({ stage });
  }

  recordGoogleLogin(outcome: GoogleLoginOutcome): void {
    m.authGoogleLogins.inc({ outcome });
  }

  recordLogout(): void {
    m.authLogouts.inc();
  }

  /* --------------------------------------------------------------- Cache */

  recordCacheRead(key: string, result: CacheResult): void {
    m.cacheOperations.inc({ namespace: cacheNamespace(key), result });
  }

  recordCacheWrite(key: string, result: 'ok' | 'error'): void {
    m.cacheWrites.inc({ namespace: cacheNamespace(key), result });
  }

  /* ------------------------------------------------------------ Upstream */

  /** Returns the function that records the outcome and the elapsed time. */
  startTmdbRequest(): (outcome: TmdbOutcome) => void {
    const stopTimer = m.tmdbRequestDuration.startTimer();
    return (outcome) => {
      m.tmdbRequests.inc({ outcome });
      stopTimer({ outcome });
    };
  }

  recordTmdbBudgetRejection(): void {
    m.tmdbBudgetRejections.inc();
  }

  startRecommenderRequest(endpoint: RecommenderEndpoint): (outcome: RecommenderOutcome) => void {
    const stopTimer = m.recommenderRequestDuration.startTimer({ endpoint });
    return (outcome) => {
      m.recommenderRequests.inc({ endpoint, outcome });
      stopTimer();
    };
  }

  recordMailSend(outcome: 'success' | 'failure'): void {
    m.mailSends.inc({ outcome });
  }

  recordUpload(outcome: 'success' | 'failure', bytes = 0): void {
    m.storageUploads.inc({ outcome });
    if (bytes > 0) m.storageUploadBytes.inc(bytes);
  }

  /* ----------------------------------------------------------- WebSocket */

  recordWsConnection(outcome: 'accepted' | 'rejected'): void {
    m.wsConnections.inc({ outcome });
  }

  recordWsDisconnection(): void {
    m.wsDisconnections.inc();
  }

  recordWsExpiredSocketDropped(): void {
    m.wsExpiredSocketsDropped.inc();
  }

  recordWsEventSent(kind: 'domain' | 'chat_message' | 'chat_read' | 'presence'): void {
    m.wsEventsSent.inc({ kind });
  }

  /**
   * Presence is authoritative in NotifyService's map, so these are set from it
   * on every change rather than counted up and down independently — a counter
   * pair drifts the moment one branch forgets to decrement.
   */
  setPresence(usersOnline: number, socketsOpen: number): void {
    m.wsUsersOnline.set(usersOnline);
    m.wsConnectionsActive.set(socketsOpen);
  }

  /* ------------------------------------------------------------ Business */

  setBusinessTotals(totals: {
    users: number;
    ratings: number;
    movies: number;
    watchlists: number;
    messages: number;
    activeSessions: number;
  }): void {
    m.appUsers.set(totals.users);
    m.appRatings.set(totals.ratings);
    m.appMovies.set(totals.movies);
    m.appWatchlists.set(totals.watchlists);
    m.appMessages.set(totals.messages);
    m.appSessionsActive.set(totals.activeSessions);
  }

  setFriendshipTotal(status: string, count: number): void {
    m.appFriendships.set({ status }, count);
  }
}

/**
 * First colon-separated segment only. Keys look like `tmdb:v1:movie:603` or
 * `pwreset:cooldown:42`, so anything past the first segment carries a query
 * string or a row id and would make the label unbounded.
 */
function cacheNamespace(key: string): string {
  const separator = key.indexOf(':');
  return separator === -1 ? key : key.slice(0, separator);
}
