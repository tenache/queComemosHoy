// localStorage wrapper. Every read and write is wrapped in try/catch: if
// storage fails the app keeps running in memory and says so.

import { defaultState, normalizeState } from './state.js';

export const STORAGE_KEY = 'qch:v1';
export const BACKUP_KEY = 'qch:v1:unreadable';

/**
 * Returns {state, problem, raw}. `problem` is:
 * - null: all good.
 * - 'unavailable': storage can't be read. The app runs in memory.
 * - 'unreadable': the saved blob is corrupt. Its text is returned as `raw`
 *   and kept under BACKUP_KEY (see readBackup), and the app starts fresh.
 * - 'newer': the blob was written by a newer version of the app. It is left
 *   untouched and the caller MUST NOT save over it: this copy of the app is
 *   out of date and should reload into the new version.
 */
export function loadState(storage = globalThis.localStorage) {
  let text;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: defaultState(), problem: 'unavailable' };
  }
  if (text == null) return { state: defaultState(), problem: null };
  try {
    return { state: normalizeState(JSON.parse(text)), problem: null };
  } catch (err) {
    if (err?.message === 'newer-schema') return { state: defaultState(), problem: 'newer' };
    try {
      storage.setItem(BACKUP_KEY, text);
    } catch {
      /* the caller still has `raw` to offer as a download */
    }
    return { state: defaultState(), problem: 'unreadable', raw: text };
  }
}

/** Returns true if the state was saved. */
export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** The text of the last blob that couldn't be read, or null. */
export function readBackup(storage = globalThis.localStorage) {
  try {
    return storage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}
