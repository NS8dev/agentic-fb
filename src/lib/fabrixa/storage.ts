/**
 * Lightweight IndexedDB wrapper for asynchronous persistence of large CAD design states.
 * This bypasses the 5MB localStorage limit, supporting hundreds of megabytes/gigabytes.
 */

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined")
      return reject(new Error("IndexedDB is only available in the browser."));
    const request = indexedDB.open("FabrixaDB", 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("keyval")) {
        db.createObjectStore("keyval");
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Persists a string value to IndexedDB.
 */
export async function setDbData(key: string, value: string): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("keyval", "readwrite");
      const store = tx.objectStore("keyval");
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("IndexedDB set failed", e);
  }
}

/**
 * Retrieves a string value from IndexedDB.
 */
export async function getDbData(key: string): Promise<string | null> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("keyval", "readonly");
      const store = tx.objectStore("keyval");
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("IndexedDB get failed", e);
    return null;
  }
}

/**
 * Deletes a value from IndexedDB.
 */
export async function deleteDbData(key: string): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("keyval", "readwrite");
      const store = tx.objectStore("keyval");
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("IndexedDB delete failed", e);
  }
}
