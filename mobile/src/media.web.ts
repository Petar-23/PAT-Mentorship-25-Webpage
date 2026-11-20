import { decodeJournal, type Film, type Journal } from './catalog';

const storeName = 'films';
let connection: Promise<IDBDatabase> | undefined;

function db() {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pat-film-preview-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => { connection = undefined; throw error; });
  }
  return connection;
}

async function access<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = database.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Speichern fehlgeschlagen.'));
  });
}

const getBlob = (film: Film) => access<Blob | undefined>('readonly', (store) => store.get(film.id));
export const remoteUri = (film: Film) => '/media/' + film.file;

export async function isSaved(film: Film) {
  return (await getBlob(film))?.size === film.bytes;
}

export async function download(film: Film) {
  const response = await fetch(remoteUri(film), { cache: 'no-store' });
  if (!response.ok) throw new Error('Der Film ist gerade nicht erreichbar.');
  const blob = await response.blob();
  if (blob.size !== film.bytes || blob.type.split(';')[0] !== 'video/mp4') throw new Error('Der Download ist unvollständig.');
  await access('readwrite', (store) => store.put(blob, film.id));
}

export async function remove(film: Film) {
  await access('readwrite', (store) => store.delete(film.id));
}

export async function playback(film: Film) {
  const blob = await getBlob(film).catch(() => undefined);
  if (blob?.size === film.bytes) {
    const uri = URL.createObjectURL(blob);
    return { uri, release: () => URL.revokeObjectURL(uri) };
  }
  return { uri: remoteUri(film), release() {} };
}

export async function readJournal() { return decodeJournal(localStorage.getItem('pat-preview-progress-v1')); }
export async function writeJournal(value: Journal) { localStorage.setItem('pat-preview-progress-v1', JSON.stringify(value)); }
