/**
 * app-kit/auth — a provider-agnostic auth / session seam for the studio's web apps.
 *
 * FRAMEWORK-FREE: this module imports neither React nor Supabase so it unit-tests
 * in isolation. App code talks only to the `AuthClient` interface below; an adapter
 * (e.g. a thin wrapper over `@supabase/supabase-js`) realizes it at the edge. That
 * keeps sign-in/out + session-observation identical whether you back it with
 * Supabase, a mock, or a future provider — the same way game-kit's net module hides
 * the transport behind `RoomClient<S>`.
 *
 * The store is synchronous + reactive: `getSession()` returns the current snapshot,
 * `onSession(fn)` subscribes (fires immediately with the current value, returns an
 * unsubscribe). Adapters push new sessions in via the returned `setSession`.
 */

/** A signed-in user — the minimal shape every provider can supply. */
export interface AuthUser {
  /** Stable provider user id. */
  id: string;
  /** Primary email, if the provider exposes one. */
  email: string | null;
}

/** The current auth snapshot. `user` is null when signed out. */
export interface Session {
  user: AuthUser | null;
  /** Opaque access token for authorized calls, or null when signed out. */
  accessToken: string | null;
}

/** Signed-out session singleton — the initial + post-sign-out state. */
export const ANON_SESSION: Session = { user: null, accessToken: null };

export type SessionListener = (session: Session) => void;

/**
 * The seam app code depends on. An adapter (Supabase / mock / …) implements this;
 * UI never imports a provider SDK directly.
 */
export interface AuthClient {
  /** Current session snapshot (never throws; returns ANON_SESSION when signed out). */
  getSession(): Session;
  /**
   * Subscribe to session changes. Fires once synchronously with the current
   * session, then on every change. Returns an unsubscribe function.
   */
  onSession(listener: SessionListener): () => void;
  /** Begin a sign-in flow (provider-specific args are bound by the adapter). */
  signIn(): Promise<void>;
  /** Clear the session locally + at the provider. */
  signOut(): Promise<void>;
}

/** Provider hooks an adapter supplies to {@link createAuthClient}. */
export interface AuthAdapter {
  /** Kick off the provider's sign-in (redirect / popup / magic-link / …). */
  signIn(): Promise<void>;
  /** End the provider session. */
  signOut(): Promise<void>;
}

/**
 * Build an `AuthClient` plus the `setSession` pump an adapter drives.
 *
 * The adapter calls `setSession(...)` whenever the provider reports a change
 * (initial load, sign-in, token refresh, sign-out). Listeners are notified only
 * when the snapshot actually differs, so a redundant refresh is a no-op.
 *
 * Returns the client (handed to app code) and `setSession` (kept by the adapter).
 */
export function createAuthClient(adapter: AuthAdapter): {
  client: AuthClient;
  setSession: (next: Session) => void;
} {
  let session: Session = ANON_SESSION;
  const listeners = new Set<SessionListener>();

  const setSession = (next: Session): void => {
    if (sameSession(session, next)) return;
    session = next;
    for (const fn of [...listeners]) fn(session);
  };

  const client: AuthClient = {
    getSession: () => session,
    onSession: (listener) => {
      listeners.add(listener);
      // Fire immediately so subscribers render against the current snapshot.
      listener(session);
      return () => {
        listeners.delete(listener);
      };
    },
    signIn: () => adapter.signIn(),
    signOut: () => adapter.signOut(),
  };

  return { client, setSession };
}

/** Structural equality over the fields that matter to subscribers. */
function sameSession(a: Session, b: Session): boolean {
  return (
    a.accessToken === b.accessToken &&
    (a.user?.id ?? null) === (b.user?.id ?? null) &&
    (a.user?.email ?? null) === (b.user?.email ?? null)
  );
}
