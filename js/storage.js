// localStorage wrapper. Every read and write is wrapped in try/catch: if
// storage fails the app keeps running in memory and says so.

import { defaultState, normalizeState } from './state.js';

export const STORAGE_KEY = 'qch:v1';
const BACKUP_KEY = 'qch:v1:unreadable';

/**
 * Returns {state, problem}. `problem` is null, 'unavailable' (storage can't be
 * read) or 'unreadable' (the saved blob was corrupt or from a newer version;
 * it's kept under BACKUP_KEY and the app starts fresh).
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
  } catch {
    try {
      storage.setItem(BACKUP_KEY, text);
    } catch {
      /* nothing more we can do */
    }
    return { state: defaultState(), problem: 'unreadable' };
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
