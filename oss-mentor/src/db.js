/**
 * Local Database Storage for OSS Mentor
 * Uses browser IndexedDB for persistent session & answer storage,
 * with localStorage synchronization for 0ms refresh restoration.
 */

const DB_NAME = 'OSSMentorDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const LAST_ACTIVE_KEY = 'oss_mentor_last_session';

/**
 * Initializes and returns the IndexedDB instance
 */
function openDB() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      resolve(null);
    };
  });
}

/**
 * Saves or updates a session in IndexedDB and localStorage
 */
export async function saveSession(session) {
  if (!session || !session.id) return;

  // 1. Sync to localStorage for instant page-load recovery
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, JSON.stringify(session));

    // Also update recent list in localStorage
    const savedList = localStorage.getItem('recentQueries');
    const list = savedList ? JSON.parse(savedList) : [];
    const filtered = list.filter((item) =>
      typeof item === 'string' ? item !== session.query : item.id !== session.id
    );
    const updated = [session, ...filtered].slice(0, 15);
    localStorage.setItem('recentQueries', JSON.stringify(updated));
  } catch (err) {
    console.warn('localStorage sync warning:', err);
  }

  // 2. Persist to IndexedDB
  try {
    const db = await openDB();
    if (!db) return;

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(session);
  } catch (err) {
    console.error('IndexedDB save error:', err);
  }
}

/**
 * Updates an existing session with arbitrary fields (messages, answer, etc.)
 */
export async function updateSession(id, updates) {
  if (!id || !updates) return;

  try {
    const last = getLastActiveSession();
    if (last && last.id === id) {
      const merged = { ...last, ...updates };
      localStorage.setItem(LAST_ACTIVE_KEY, JSON.stringify(merged));
    }

    const savedList = localStorage.getItem('recentQueries');
    if (savedList) {
      const list = JSON.parse(savedList);
      const updated = list.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      );
      localStorage.setItem('recentQueries', JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('localStorage update warning:', err);
  }

  try {
    const db = await openDB();
    if (!db) return;

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => {
      const existing = req.result;
      if (existing) {
        const merged = { ...existing, ...updates };
        store.put(merged);
      }
    };
  } catch (err) {
    console.error('IndexedDB update error:', err);
  }
}

/**
 * Updates only the answer of an existing session
 */
export async function updateSessionAnswer(id, answer) {
  return updateSession(id, { answer });
}

/**
 * Returns all saved sessions ordered by most recent first
 */
export async function getAllSessions() {
  try {
    const db = await openDB();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const results = req.result || [];
          results.sort((a, b) => (b.id || 0) - (a.id || 0));
          resolve(results);
        };

        req.onerror = () => {
          resolve(getRecentFromLocalStorage());
        };
      });
    }
  } catch {
    // Fallback
  }

  return getRecentFromLocalStorage();
}

/**
 * Deletes a session by ID
 */
export async function deleteSession(id) {
  try {
    // Remove from localStorage
    const savedList = localStorage.getItem('recentQueries');
    if (savedList) {
      const list = JSON.parse(savedList);
      const updated = list.filter((item) => item.id !== id);
      localStorage.setItem('recentQueries', JSON.stringify(updated));
    }

    const last = getLastActiveSession();
    if (last && last.id === id) {
      localStorage.removeItem(LAST_ACTIVE_KEY);
    }

    // Remove from IndexedDB
    const db = await openDB();
    if (!db) return;

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
  } catch (err) {
    console.error('IndexedDB delete error:', err);
  }
}

/**
 * Clears all saved sessions
 */
export async function clearAllSessions() {
  try {
    localStorage.removeItem('recentQueries');
    localStorage.removeItem(LAST_ACTIVE_KEY);

    const db = await openDB();
    if (!db) return;

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
  } catch (err) {
    console.error('IndexedDB clear error:', err);
  }
}

/**
 * Returns the last active session from localStorage for 0ms page-load restoration
 */
export function getLastActiveSession() {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clears the active session marker (e.g. when user clicks "New Question")
 */
export function clearLastActiveSession() {
  try {
    localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch {
    // Ignore
  }
}

function getRecentFromLocalStorage() {
  try {
    const saved = localStorage.getItem('recentQueries');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}
