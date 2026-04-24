/**
 * resolveAccounts.ts
 *
 * Single source of truth for "what accounts exist right now?" at login time.
 *
 * Merges three localStorage keys written by Users.tsx with the static JSON
 * imports so that login always sees the current state of every account.
 *
 * Keys consumed (must stay in sync with Users.tsx constants):
 *   worktime_created_accounts_v1   – accounts added via the UI
 *   worktime_account_edits_v1      – name / email / password overrides
 *   worktime_deleted_account_ids_v1 – tombstone list, e.g. ["user:3","admin:101"]
 */

const CREATED_KEY = "worktime_created_accounts_v1";
const DELETED_KEY = "worktime_deleted_account_ids_v1";
const EDITS_KEY   = "worktime_account_edits_v1";

type AccountKind = "user" | "admin";

// Only the fields Users.tsx actually stores / that login cares about.
type StoredCreatedAccount = {
  id:       number;
  kind:     AccountKind;
  name:     string;
  email:    string;
  password: string;
};

type AccountEdit = {
  name?:     string;
  email?:    string;
  password?: string;
};

type EditsMap = Record<string, AccountEdit>;

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Minimal shape that every login handler needs. */
export type ResolvedAccount = {
  id:       number;
  name:     string;
  email:    string;
  password: string;
};

/**
 * Returns the authoritative account list for a given kind at the moment of
 * login, factoring in:
 *   1. Static JSON accounts (passed in by the caller)
 *   2. Admin-applied edits (email / password resets etc.)
 *   3. Locally-created accounts of the matching kind
 *   4. Deleted-ID tombstones (excluded from the result)
 */
export function resolveMergedAccounts(
  staticAccounts: Array<{ id: number; name: string; email: string; password: string }>,
  kind: AccountKind,
): ResolvedAccount[] {
  const deleted = new Set<string>(safeRead<string[]>(DELETED_KEY, []));
  const edits   = safeRead<EditsMap>(EDITS_KEY, {});
  const created = safeRead<StoredCreatedAccount[]>(CREATED_KEY, []);

  const result: ResolvedAccount[] = [];

  // 1. Static accounts – apply any stored edits, skip tombstoned IDs.
  for (const a of staticAccounts) {
    const key = `${kind}:${a.id}`;
    if (deleted.has(key)) continue;
    const edit = edits[key] ?? {};
    result.push({
      id:       a.id,
      name:     edit.name     ?? a.name,
      email:    edit.email    ?? a.email,
      password: edit.password ?? a.password,
    });
  }

  // 2. Locally-created accounts of this kind – same edit + delete logic.
  for (const a of created) {
    if (a.kind !== kind) continue;
    const key = `${kind}:${a.id}`;
    if (deleted.has(key)) continue;
    const edit = edits[key] ?? {};
    result.push({
      id:       a.id,
      name:     edit.name     ?? a.name,
      email:    edit.email    ?? a.email,
      password: edit.password ?? a.password,
    });
  }

  return result;
}