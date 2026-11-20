import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/expo';
import { File, Paths } from 'expo-file-system';

// Last catalog + progress on disk so the app opens instantly; the network refresh follows.
const cacheFile = new File(Paths.cache, 'pat-academy-v1.json');
function readCache(): { rows: [ApiPlaylist[], ApiModule[], ApiChapter[]]; watched: string[] } | null {
  try { return cacheFile.exists ? JSON.parse(cacheFile.textSync()) : null; } catch { return null; }
}
function writeCache(rows: unknown, watched: string[]) {
  try { cacheFile.write(JSON.stringify({ rows, watched })); } catch { /* cache is optional */ }
}

/** The app talks to the live PAT website. Override with EXPO_PUBLIC_API_ORIGIN for a local web server. */
export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_ORIGIN || 'https://www.price-action-trader.de').replace(/\/$/, '');

export type Lesson = {
  id: string; title: string; order: number; duration: number | null; pdfUrl: string | null; thumbnailUrl: string | null;
  hasVideo: boolean; bunnyGuid: string | null; showNotes: string | null; chapterId: string; chapterName: string; moduleId: string; courseId: string;
};
export type Chapter = { id: string; name: string; order: number; lessons: Lesson[] };
export type Module = { id: string; name: string; order: number; description: string | null; imageUrl: string | null; courseId: string; chapters: Chapter[] };
export type Course = { id: string; name: string; slug: string; description: string | null; iconUrl: string | null; createdAt: string; modules: Module[] };

type Access = 'loading' | 'member' | 'locked' | 'closed' | 'error';

type Academy = {
  access: Access;
  startDate: string | null;
  courses: Course[];
  lessons: Map<string, Lesson>;
  modules: Map<string, Module>;
  watched: Set<string>;
  lastLessonId: string | null;
  refreshing: boolean;
  error: string;
  refresh: () => Promise<void>;
  setWatched: (lessonId: string, watched: boolean, manual: boolean) => Promise<void>;
  rememberLesson: (lessonId: string) => void;
  playbackUrl: (lessonId: string, autoplay?: boolean) => Promise<string>;
  authHeaders: () => Promise<Record<string, string>>;
};

const Context = createContext<Academy | null>(null);
export function useAcademy() {
  const value = useContext(Context);
  if (!value) throw new Error('AcademyProvider fehlt.');
  return value;
}

export class HttpError extends Error { constructor(public status: number) { super('HTTP ' + status); } }

type ApiChapter = {
  id: string; name: string; order: number; moduleId: string;
  videos: { id: string; title: string; bunnyGuid: string | null; showNotes?: string | null; pdfUrl: string | null; thumbnailUrl: string | null; order: number; duration: number | null }[];
  module: { id: string; name: string; order: number; playlistId: string; description: string | null; imageUrl: string | null };
};
type ApiModule = { id: string; name: string; order: number; playlistId: string; description: string | null; imageUrl: string | null };
type ApiPlaylist = { id: string; name: string; slug: string; description: string | null; iconUrl: string | null; createdAt: string };

function absolute(url: string | null) {
  if (!url) return null;
  return url.startsWith('/') ? API_ORIGIN + url : url;
}

/** Month modules (März 2026 … November 2026) run oldest first; others keep the website order. */
function chronological(mods: Module[]) {
  const keys = mods.map(m => monthKey(m.name));
  if (mods.length < 2 || keys.some(k => k === null)) return mods;
  return mods.map((m, i) => ({ m, k: keys[i]! })).sort((a, b) => a.k - b.k).map(x => x.m);
}

export function buildCatalog(playlists: ApiPlaylist[], moduleRows: ApiModule[], chapterRows: ApiChapter[]) {
  const modules = new Map<string, Module>();
  for (const m of moduleRows) {
    modules.set(m.id, { id: m.id, name: m.name, order: m.order, description: m.description, imageUrl: absolute(m.imageUrl), courseId: m.playlistId, chapters: [] });
  }
  const lessons = new Map<string, Lesson>();
  for (const c of chapterRows) {
    let mod = modules.get(c.moduleId);
    if (!mod) {
      mod = { id: c.module.id, name: c.module.name, order: c.module.order, description: c.module.description, imageUrl: absolute(c.module.imageUrl), courseId: c.module.playlistId, chapters: [] };
      modules.set(mod.id, mod);
    }
    const chapter: Chapter = { id: c.id, name: c.name, order: c.order, lessons: [] };
    for (const v of [...c.videos].sort((a, b) => a.order - b.order)) {
      const lesson: Lesson = {
        id: v.id, title: v.title, order: v.order, duration: v.duration, pdfUrl: absolute(v.pdfUrl), thumbnailUrl: absolute(v.thumbnailUrl),
        hasVideo: !!v.bunnyGuid, bunnyGuid: v.bunnyGuid, showNotes: v.showNotes?.trim() || null, chapterId: c.id, chapterName: c.name, moduleId: mod.id, courseId: mod.courseId,
      };
      chapter.lessons.push(lesson);
      lessons.set(lesson.id, lesson);
    }
    mod.chapters.push(chapter);
  }
  const byOrder = (a: { order: number; name: string }, b: { order: number; name: string }) => a.order - b.order || a.name.localeCompare(b.name, 'de', { numeric: true });
  for (const mod of modules.values()) mod.chapters.sort(byOrder);
  const courses: Course[] = playlists.map(p => ({
    id: p.id, name: p.name, slug: p.slug, description: p.description, iconUrl: absolute(p.iconUrl), createdAt: p.createdAt,
    modules: chronological([...modules.values()].filter(m => m.courseId === p.id && m.chapters.some(c => c.lessons.length > 0)).sort(byOrder)),
  }));
  const ordered = groupCourses(courses).flatMap(g => g.courses);
  return { courses: ordered.filter(c => c.modules.length > 0), modules, lessons };
}

const MONTHS: Record<string, number> = { jan: 1, januar: 1, feb: 2, februar: 2, mär: 3, märz: 3, maerz: 3, mrz: 3, apr: 4, april: 4, mai: 5, jun: 6, juni: 6,
  jul: 7, juli: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, dez: 12, dezember: 12 };

/** "03 - Mai 2026" → 202605; null when the name carries no month. */
export function monthKey(name: string) {
  const m = /\b(januar|februar|märz|maerz|mrz|april|mai|juni|juli|august|september|oktober|november|dezember|jan|feb|mär|apr|jun|jul|aug|sept|sep|okt|nov|dez)\.?\s*(\d{4})?/i.exec(name);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  const year = m[2] ? Number(m[2]) : 2026;
  return year * 100 + month;
}

export type CourseGroup = { key: string; number: string; title: string; courses: Course[] };

const GROUPS: { key: string; number: string; title: string; test: RegExp }[] = [
  { key: 'reviews', number: '01', title: 'Daily & Weekly Reviews', test: /daily|weekly|review/i },
  { key: 'content', number: '02', title: 'Core & Advanced Content', test: /core|kern|advanced/i },
  { key: 'model', number: '03', title: 'Model Series', test: /model/i },
  { key: 'algo', number: '04', title: 'PAT Algo', test: /algo/i },
];

/** The website's four Mentorship sections; anything unmatched lands in "Weitere". */
export function groupCourses(courses: Course[]): CourseGroup[] {
  const groups: CourseGroup[] = GROUPS.map(g => ({ key: g.key, number: g.number, title: g.title, courses: [] }));
  const rest: CourseGroup = { key: 'rest', number: '05', title: 'Weitere', courses: [] };
  for (const c of courses) {
    const i = GROUPS.findIndex(g => g.test.test(c.name));
    (i >= 0 ? groups[i] : rest).courses.push(c);
  }
  // Daily before Weekly, Core before Advanced.
  const rank = (c: Course) => /daily|core|kern/i.test(c.name) ? 0 : 1;
  for (const g of groups) g.courses.sort((a, b) => rank(a) - rank(b));
  return [...groups, rest].filter(g => g.courses.length);
}

/** All lessons of a course in watch order. */
export function courseLessons(course: Course) {
  return course.modules.flatMap(m => m.chapters.flatMap(c => c.lessons));
}
export function moduleLessons(mod: Module) {
  return mod.chapters.flatMap(c => c.lessons);
}

export function AcademyProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const [access, setAccess] = useState<Access>('loading');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ReturnType<typeof buildCatalog>>({ courses: [], modules: new Map(), lessons: new Map() });
  const [watched, setWatchedSet] = useState<Set<string>>(new Set());
  const [lastLessonId, setLastLessonId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loaded = useRef(false);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();
    return token ? { Authorization: 'Bearer ' + token } : {};
  }, [getToken]);

  const request = useCallback(async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
    const response = await fetch(API_ORIGIN + path, {
      method: init?.method ?? 'GET',
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(await authHeaders()) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    if (!response.ok) throw new HttpError(response.status);
    return response.json() as Promise<T>;
  }, [authHeaders]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const status = await request<{ accessible: boolean; startDate: string; hasSubscription: boolean }>('/api/mentorship-status');
      setStartDate(status.startDate);
      // The catalog endpoints decide access themselves (subscription, override or admin), so try them directly.
      let rows: [ApiPlaylist[], ApiModule[], ApiChapter[]];
      try {
        rows = await Promise.all([request<ApiPlaylist[]>('/api/playlists'), request<ApiModule[]>('/api/modules'), request<ApiChapter[]>('/api/chapters')]);
      } catch (e) {
        if (e instanceof HttpError && e.status === 403) { setAccess(status.accessible ? 'locked' : 'closed'); return; }
        throw e;
      }
      const next = buildCatalog(...rows);
      setCatalog(next);
      writeCache(rows, [...(readCache()?.watched ?? [])]);
      setAccess('member');
      loaded.current = true;
      // Show the catalog right away; progress per module streams in afterwards.
      void Promise.allSettled([...next.modules.keys()].map(id => request<{ watchedVideoIds: string[] }>('/api/progress/module/' + id))).then(progress => {
        const seen = new Set<string>();
        for (const p of progress) if (p.status === 'fulfilled') p.value.watchedVideoIds.forEach(id => seen.add(id));
        setWatchedSet(seen);
        writeCache(rows, [...seen]);
      });
    } catch (e) {
      setError(e instanceof HttpError && e.status === 401 ? 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.' : 'Die Mentorship konnte gerade nicht geladen werden. Prüfe deine Verbindung.');
      if (!loaded.current) setAccess('error');
    } finally {
      setRefreshing(false);
    }
  }, [request]);

  useEffect(() => {
    if (isSignedIn) {
      const cached = readCache();
      if (cached && !loaded.current) {
        setCatalog(buildCatalog(...cached.rows));
        setWatchedSet(new Set(cached.watched));
        setAccess('member');
        loaded.current = true;
      }
      void refresh();
    }
    else { try { if (cacheFile.exists) cacheFile.delete(); } catch {} loaded.current = false; setAccess('loading'); setCatalog({ courses: [], modules: new Map(), lessons: new Map() }); setWatchedSet(new Set()); setLastLessonId(null); }
  }, [isSignedIn, refresh]);

  const setWatched = useCallback(async (lessonId: string, value: boolean, manual: boolean) => {
    const before = new Set(watched);
    setWatchedSet(old => { const n = new Set(old); if (value) n.add(lessonId); else n.delete(lessonId); return n; });
    try {
      await request('/api/progress/video/' + lessonId, { method: 'POST', body: { watched: value, manual } });
    } catch {
      setWatchedSet(before);
      throw new Error('Der Fortschritt konnte nicht gespeichert werden.');
    }
  }, [request, watched]);

  const rememberLesson = useCallback((lessonId: string) => {
    setLastLessonId(lessonId);
    void request('/api/playback/last-viewed', { method: 'POST', body: { videoId: lessonId } }).catch(() => {});
  }, [request]);

  const playbackUrl = useCallback(async (lessonId: string, autoplay = true) => {
    try {
      const signed = await request<{ url: string }>('/api/playback/video/' + lessonId + '?autoplay=' + autoplay);
      return signed.url;
    } catch (e) {
      // The live site may not ship signed playback yet; fall back to the same embed the web player uses.
      const guid = catalog.lessons.get(lessonId)?.bunnyGuid;
      const library = process.env.EXPO_PUBLIC_BUNNY_LIBRARY_ID;
      if (e instanceof HttpError && e.status === 404 && guid && library) {
        return 'https://iframe.mediadelivery.net/embed/' + encodeURIComponent(library) + '/' + encodeURIComponent(guid) + '?autoplay=' + autoplay + '&preload=true&responsive=true';
      }
      throw e;
    }
  }, [request, catalog]);

  const value = useMemo<Academy>(() => ({
    access, startDate, courses: catalog.courses, lessons: catalog.lessons, modules: catalog.modules, watched, lastLessonId,
    refreshing, error, refresh, setWatched, rememberLesson, playbackUrl, authHeaders,
  }), [access, startDate, catalog, watched, lastLessonId, refreshing, error, refresh, setWatched, rememberLesson, playbackUrl, authHeaders]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** "01 - Core Content" → { number: '01', title: 'Core Content' } */
export function splitName(name: string) {
  const m = /^\s*(\d{1,3})\s*[-–.:]\s*(.+)$/.exec(name);
  return m ? { number: m[1].padStart(2, '0'), title: m[2] } : { number: null, title: name };
}

/** "2026-03-03 - Daily Review" reads as "Daily Review 03.03.2026", matching the newer lesson titles. */
export function lessonTitle(title: string) {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*[-–:]\s*(.+)$/.exec(title);
  return m ? m[4] + ' ' + m[3] + '.' + m[2] + '.' + m[1] : title;
}
export function minutes(seconds: number | null) {
  if (!seconds) return '';
  const m = Math.max(1, Math.round(seconds / 60));
  return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60 ? (m % 60) + ' min' : '') : m + ' min';
}
