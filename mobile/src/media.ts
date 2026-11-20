import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { decodeJournal, type Film, type Journal } from './catalog';

const offline = new Directory(Paths.document, 'pat-preview-films');
const journal = new File(Paths.document, 'pat-preview-progress.json');
const localFile = (film: Film) => new File(offline, film.file);

export function remoteUri(film: Film) {
  const configured = process.env.EXPO_PUBLIC_PREVIEW_MEDIA_ORIGIN;
  const devHost = Constants.expoConfig?.hostUri;
  const origin = configured || (__DEV__ && devHost ? 'http://' + devHost : '');
  if (!origin) throw new Error('Der Vorschau-Server ist nicht verbunden.');
  return origin.replace(/\/$/, '') + '/media/' + film.file;
}

export async function isSaved(film: Film) {
  const file = localFile(film);
  return file.exists && file.size === film.bytes;
}

export async function download(film: Film) {
  if (await isSaved(film)) return;
  offline.create({ idempotent: true, intermediates: true });
  const destination = localFile(film);
  const partial = new File(offline, film.file + '.part');
  if (partial.exists) partial.delete();
  try {
    await File.downloadFileAsync(remoteUri(film), partial);
    if (partial.size !== film.bytes) throw new Error('Der Download ist unvollständig.');
    if (destination.exists) destination.delete();
    await partial.move(destination);
  } finally {
    // move() updates the File instance's URI. Only clean the original staging path.
    const leftover = new File(offline, film.file + '.part');
    if (leftover.exists) leftover.delete();
  }
}

export async function remove(film: Film) {
  const file = localFile(film);
  if (file.exists) file.delete();
}

export async function playback(film: Film) {
  const uri = await isSaved(film) ? localFile(film).uri : remoteUri(film);
  return { uri, release() {} };
}

export async function readJournal() {
  return decodeJournal(journal.exists ? await journal.text() : null);
}

export async function writeJournal(value: Journal) {
  await journal.write(JSON.stringify(value));
}
