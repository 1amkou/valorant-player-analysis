// Only normalized display data is stored; never store the original ZIP or JSON.
const DB_NAME = 'valorant-player-viewer';
const STORE = 'data';
const KEY = 'current';

function openDatabase() {
  return new Promise((resolve, reject) => {
    let request;
    try { request = indexedDB.open(DB_NAME, 1); } catch (error) { reject(error); return; }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onerror = () => reject(request.error ?? new Error('Storage unavailable'));
    request.onblocked = () => reject(new Error('Storage is blocked by another tab'));
    request.onsuccess = () => resolve(request.result);
  });
}
async function transact(mode, callback) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      let result;
      const tx = db.transaction(STORE, mode);
      const request = callback(tx.objectStore(STORE));
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'));
      tx.onerror = () => {};
    });
  } finally { db.close(); }
}
export const loadSavedData = () => transact('readonly', store => store.get(KEY));
export const saveData = dataset => transact('readwrite', store => store.put({version:1,dataset}, KEY));
export const clearSavedData = () => transact('readwrite', store => store.delete(KEY));
