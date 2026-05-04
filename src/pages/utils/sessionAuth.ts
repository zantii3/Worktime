const CURRENT_USER_KEY = "currentUser";
const CURRENT_ADMIN_KEY = "currentAdmin";
const ADMIN_TOKEN_KEY = "admin_token";
const ADMIN_EMAIL_KEY = "admin_email";

const LEGACY_AUTH_KEYS = [
  CURRENT_USER_KEY,
  CURRENT_ADMIN_KEY,
  ADMIN_TOKEN_KEY,
  ADMIN_EMAIL_KEY,
] as const;

function migrateLegacyKey(key: string): string | null {
  const sessionValue = sessionStorage.getItem(key);
  if (sessionValue !== null) return sessionValue;

  const legacyValue = localStorage.getItem(key);
  if (legacyValue === null) return null;

  sessionStorage.setItem(key, legacyValue);
  localStorage.removeItem(key);
  return legacyValue;
}

function readSessionValue(key: string): string | null {
  return migrateLegacyKey(key);
}

function writeSessionValue(key: string, value: string) {
  sessionStorage.setItem(key, value);
  localStorage.removeItem(key);
}

function removeSessionValue(key: string) {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

function readSessionJSON<T>(key: string): T | null {
  try {
    const raw = readSessionValue(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeSessionJSON(key: string, value: unknown) {
  writeSessionValue(key, JSON.stringify(value));
}

export function migrateLegacyAuthSession() {
  LEGACY_AUTH_KEYS.forEach((key) => {
    migrateLegacyKey(key);
  });
}

export function getCurrentUser<T>() {
  return readSessionJSON<T>(CURRENT_USER_KEY);
}

export function setCurrentUser(value: unknown) {
  writeSessionJSON(CURRENT_USER_KEY, value);
}

export function clearCurrentUser() {
  removeSessionValue(CURRENT_USER_KEY);
}

export function getCurrentAdmin<T>() {
  return readSessionJSON<T>(CURRENT_ADMIN_KEY);
}

export function setCurrentAdmin(value: unknown) {
  writeSessionJSON(CURRENT_ADMIN_KEY, value);
}

export function clearCurrentAdmin() {
  removeSessionValue(CURRENT_ADMIN_KEY);
}

export function getAdminToken() {
  return readSessionValue(ADMIN_TOKEN_KEY);
}

export function setAdminToken(value: string) {
  writeSessionValue(ADMIN_TOKEN_KEY, value);
}

export function clearAdminToken() {
  removeSessionValue(ADMIN_TOKEN_KEY);
}

export function getAdminEmail() {
  return readSessionValue(ADMIN_EMAIL_KEY);
}

export function setAdminEmail(value: string) {
  writeSessionValue(ADMIN_EMAIL_KEY, value);
}

export function clearAdminEmail() {
  removeSessionValue(ADMIN_EMAIL_KEY);
}

export { ADMIN_EMAIL_KEY, ADMIN_TOKEN_KEY, CURRENT_ADMIN_KEY, CURRENT_USER_KEY };
