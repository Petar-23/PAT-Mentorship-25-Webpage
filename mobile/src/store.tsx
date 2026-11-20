import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as Haptics from 'expo-haptics';
import { films, type Film, type Journal, type Progress } from './catalog';
import * as media from './media';

type Store = {
  ready: boolean;
  saved: string[];
  busy: string[];
  errors: Record<string, string>;
  notice: string;
  journal: Journal;
  update: (id: string, progress: Progress) => void;
  progressAt: (film: Film, seconds: number) => void;
  toggleSeen: (film: Film) => void;
  changeDownload: (film: Film, remove: boolean) => Promise<void>;
};

const Context = createContext<Store | null>(null);

export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error('StoreProvider fehlt.');
  return store;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState<string[]>([]);
  const jobs = useRef(new Set<string>());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [journal, setJournal] = useState<Journal>({});
  const latest = useRef<Journal>({});
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let alive = true;
    const restore = async () => {
      const checks = await Promise.allSettled(films.map(media.isSaved));
      const progress = await media.readJournal().catch(() => ({}));
      if (!alive) return;
      setSaved(films.filter((_, i) => checks[i].status === 'fulfilled' && checks[i].value).map(item => item.id));
      if (checks.some(item => item.status === 'rejected')) setNotice('Der Gerätespeicher ist gerade nicht verfügbar.');
      latest.current = progress;
      setJournal(progress);
      setReady(true);
    };
    void restore();
    return () => { alive = false; };
  }, []);

  function update(id: string, progress: Progress) {
    if (!ready) return;
    const next = { ...latest.current, [id]: progress };
    latest.current = next;
    setJournal(next);
    writes.current = writes.current.then(() => media.writeJournal(next)).catch(() => {
      setNotice('Der Lernstand konnte auf diesem Gerät nicht gespeichert werden.');
    });
  }

  function progressAt(item: Film, seconds: number) {
    if (!Number.isFinite(seconds)) return;
    const prev = latest.current[item.id] ?? { seen: false, seconds: 0 };
    if (Math.abs(prev.seconds - seconds) >= 2) update(item.id, { ...prev, seconds: Math.floor(seconds) });
  }

  function toggleSeen(item: Film) {
    const prev = latest.current[item.id];
    void Haptics.selectionAsync().catch(() => {});
    update(item.id, { seconds: prev?.seconds ?? 0, seen: !prev?.seen });
  }

  async function changeDownload(item: Film, remove: boolean) {
    if (jobs.current.has(item.id)) return;
    jobs.current.add(item.id);
    setBusy([...jobs.current]);
    setErrors(old => ({ ...old, [item.id]: '' }));
    try {
      if (remove) await media.remove(item);
      else await media.download(item);
      setSaved(old => remove ? old.filter(id => id !== item.id) : [...new Set([...old, item.id])]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrors(old => ({ ...old, [item.id]: remove ? 'Der Download konnte nicht entfernt werden. Versuche es erneut.' :
        'Speichern fehlgeschlagen. Prüfe Verbindung und freien Speicher und versuche es erneut.' }));
    } finally {
      jobs.current.delete(item.id);
      setBusy([...jobs.current]);
    }
  }

  return <Context.Provider value={{ ready, saved, busy, errors, notice, journal, update, progressAt, toggleSeen, changeDownload }}>
    {children}
  </Context.Provider>;
}
