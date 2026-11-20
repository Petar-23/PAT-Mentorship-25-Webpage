import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { API_ORIGIN, HttpError, groupCourses, lessonTitle, monthKey, splitName, courseLessons, minutes, moduleLessons, useAcademy, type Course, type Lesson, type Module } from './academy';
import { Ambient, Chip, FadeIn, Glass, GlassButton, Pressy, ProgressBar, SectionTitle, Symbol, radius, tick } from './glass';
import LessonPlayer from './LessonPlayer';
import Markdown from './Markdown';
import { Cover, motifFor, type Motif } from './Art';
import { color, font } from './ui';


type ScrollMetrics = { y: number; top: number; bottom: number; content: number; viewport: number };

function Page({ children, glow = 'rgba(231,131,112,.18)', refresh, scrollRef, metrics }: {
  children: ReactNode; glow?: string; refresh?: boolean;
  scrollRef?: React.RefObject<ScrollViewInstance | null>; metrics?: React.MutableRefObject<ScrollMetrics>;
}) {
  const academy = useAcademy();
  // Only a user's pull shows the spinner; background refreshes stay invisible.
  const [pulling, setPulling] = useState(false);
  const pull = async () => { setPulling(true); try { await academy.refresh(); } finally { setPulling(false); } };
  return <ScrollView ref={scrollRef} style={s.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
    scrollEventThrottle={metrics ? 16 : undefined}
    onScroll={metrics ? e => { const n = e.nativeEvent; metrics.current.y = n.contentOffset.y; metrics.current.top = n.contentInset.top; metrics.current.bottom = n.contentInset.bottom; } : undefined}
    onContentSizeChange={metrics ? (_w, h) => { metrics.current.content = h; } : undefined}
    onLayout={metrics ? e => { metrics.current.viewport = e.nativeEvent.layout.height; } : undefined}
    refreshControl={refresh ? <RefreshControl refreshing={pulling} onRefresh={() => void pull()} tintColor={color.accent}/> : undefined}>
    <View pointerEvents="none" style={s.ambient}><Ambient glow={glow} height={760}/></View>
    {children}
  </ScrollView>;
}

function motifOf(courses: Course[], courseId: string): Motif {
  const c = courses.find(x => x.id === courseId);
  return motifFor(c?.name ?? '', courseId);
}

function progressOf(lessons: Lesson[], watched: Set<string>) {
  const done = lessons.filter(l => watched.has(l.id)).length;
  return { done, total: lessons.length, ratio: lessons.length ? done / lessons.length : 0 };
}

function nextLesson(lessons: Lesson[], watched: Set<string>) {
  return lessons.find(l => !watched.has(l.id) && l.hasVideo) ?? lessons.find(l => !watched.has(l.id)) ?? null;
}

/* ───────────── Start ───────────── */

function useGate() {
  const academy = useAcademy();
  const { access } = academy;
  if (access === 'loading') return <Page><ActivityIndicator color={color.accent} style={{ marginTop: 80 }}/></Page>;
  if (access === 'error') return <Page refresh><StateCard symbol="wifi.exclamationmark" title="Keine Verbindung" text={academy.error}
    action={<GlassButton prominent symbol="arrow.clockwise" label="Erneut laden" onPress={() => void academy.refresh()}/>}/></Page>;
  if (access === 'locked' || access === 'closed') return <Page refresh><Locked closed={access === 'closed'} startDate={academy.startDate}/></Page>;
  return null;
}

/** Lesson date from titles like "Daily Review 05.11.2026" or "2026-05-05 - …" as yyyymmdd. */
function dateKey(title: string) {
  const de = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(title);
  if (de) return Number(de[3]) * 10000 + Number(de[2]) * 100 + Number(de[1]);
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(title);
  if (iso) return Number(iso[1]) * 10000 + Number(iso[2]) * 100 + Number(iso[3]);
  return null;
}

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
}

/* ───────────── Start (Dashboard) ───────────── */

export function DashboardScreen() {
  const router = useRouter();
  const academy = useAcademy();
  const { user } = useUser();
  const gate = useGate();
  if (gate) return gate;
  const { courses, watched, lessons, lastLessonId } = academy;

  const all = courses.flatMap(courseLessons);
  const overall = progressOf(all, watched);
  const last = lastLessonId ? lessons.get(lastLessonId) : undefined;
  const up = last && !watched.has(last.id) ? last : nextLesson(all, watched);
  const upModule = up ? academy.modules.get(up.moduleId) : undefined;
  const upKicker = up ? (upModule ? splitName(upModule.name).title : up.chapterName) : '';
  const upCourse = up ? courses.find(c => c.id === up.courseId) : undefined;
  // Each fact once: course, then the chapter only if it says more than the kicker, then the length.
  const upMeta = up ? [upCourse ? splitName(upCourse.name).title.replace(/\s*\(.*\)\s*$/, '') : '', up.chapterName, minutes(up.duration)]
    .filter((x, i, a) => x && x.toLowerCase() !== upKicker.toLowerCase() && a.indexOf(x) === i).join('  ·  ') : '';
  const courseTitle = (l: Lesson) => { const c = courses.find(x => x.id === l.courseId); return c ? splitName(c.name).title.replace(/\s*\(.*\)\s*$/, '') : ''; };
  const openLesson = (l: Lesson) => { tick(); router.push({ pathname: '/(mentorship)/lektion/[id]', params: { id: l.id } }); };
  const groups = groupCourses(courses);
  const recent = [...all].map(l => ({ l, k: dateKey(l.title) ?? (monthKey(academy.modules.get(l.moduleId)?.name ?? '') ?? 0) * 100 }))
    .sort((a, b) => b.k - a.k || b.l.order - a.l.order).slice(0, 4).map(x => x.l);

  return <Page refresh>
    <Stack.Screen options={{ title: greeting() + (user?.firstName ? ', ' + user.firstName : '') }}/>
    {academy.error ? <Text accessibilityRole="alert" style={s.notice}>{academy.error}</Text> : null}
    <FadeIn>
      {up ? <Pressy onPress={() => openLesson(up)} style={s.hero} accessibilityLabel={'Weiter mit ' + up.title}>
        <View style={s.heroArt}>
          <Cover seed={upModule?.id ?? up.id} motif={motifOf(courses, up.courseId)} style={s.fill}/>
          <View style={s.heroTop}><Chip onImage symbol={overall.done ? 'play.circle' : 'sparkles'} label={overall.done ? 'Weiter lernen' : 'Dein Start'}/></View>
        </View>
        <View style={s.heroBody}>
          <Text style={s.kicker} numberOfLines={1}>{upKicker}</Text>
          <Text style={s.heroTitle} numberOfLines={3}>{lessonTitle(up.title)}</Text>
          {upMeta ? <Text style={s.heroText} numberOfLines={1}>{upMeta}</Text> : null}
          <View style={s.heroActions}>
            <GlassButton prominent symbol="play.fill" label="Weiter ansehen" onPress={() => openLesson(up)}/>
          </View>
        </View>
      </Pressy> : <StateCard symbol="checkmark.seal.fill" title="Alles angesehen" text="Du hast jede Lektion abgeschlossen. Stark! Neue Inhalte erscheinen hier automatisch."/>}
    </FadeIn>

    <FadeIn delay={60}>
      <View style={s.stats}>
        <Stat value={overall.done + ''} label="Erledigt"/>
        <View style={s.statDivider}/>
        <Stat value={overall.total - overall.done + ''} label="Offen"/>
        <View style={s.statDivider}/>
        <Stat value={Math.round(overall.ratio * 100) + '%'} label="Fortschritt"/>
      </View>
    </FadeIn>

    <FadeIn delay={120}>
      <SectionTitle detail="Mentorship">Deine Sektionen</SectionTitle>
      <View style={s.tiles}>
        {groups.map(g => {
          const ls = g.courses.flatMap(courseLessons);
          const p = progressOf(ls, watched);
          return <Pressy key={g.key} style={s.tile} containerStyle={s.tileBox} accessibilityLabel={g.title}
            onPress={() => { tick(); g.courses.length === 1 ? router.push({ pathname: '/(mentorship)/kurs/[id]', params: { id: g.courses[0].id } }) : router.navigate('/(mentorship)/kurse'); }}>
            <View style={s.tileArt}><Cover seed={g.key} motif={motifFor(g.courses[0]?.name ?? '', g.key)} compact style={s.fill}/></View>
            <View style={s.tileBody}>
              <Text style={s.kicker}>{g.number}</Text>
              <Text style={s.tileTitle} numberOfLines={2}>{g.title}</Text>
              <ProgressBar value={p.ratio} style={{ marginTop: 8 }}/>
            </View>
          </Pressy>;
        })}
      </View>
    </FadeIn>

    {recent.length ? <FadeIn delay={180}>
      <SectionTitle detail="Neueste">Neu dazugekommen</SectionTitle>
      <View style={s.group}>
        {recent.map((l, i) => <LessonRow key={l.id} lesson={l} context={courseTitle(l)} done={watched.has(l.id)} last={i === recent.length - 1} onPress={() => openLesson(l)}/>)}
      </View>
    </FadeIn> : null}
  </Page>;
}

/* ───────────── Mentorship (Sektionen) ───────────── */

export function CoursesScreen() {
  const router = useRouter();
  const academy = useAcademy();
  const gate = useGate();
  if (gate) return gate;
  return <Page refresh>
    {groupCourses(academy.courses).map((group, gi) => <FadeIn key={group.key} delay={gi * 70}>
      <SectionTitle detail={group.number}>{group.title}</SectionTitle>
      <View style={{ gap: 10 }}>
        {group.courses.map(course => <CourseCard key={course.id} course={course} onPress={() => { tick(); router.push({ pathname: '/(mentorship)/kurs/[id]', params: { id: course.id } }); }}/>)}
      </View>
    </FadeIn>)}
  </Page>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>;
}

function CourseCard({ course, onPress }: { course: Course; onPress: () => void }) {
  const { watched } = useAcademy();
  const p = progressOf(courseLessons(course), watched);
  const name = splitName(course.name);
  return <Pressy onPress={onPress} style={s.courseRow} accessibilityLabel={course.name + ' öffnen'}>
    <View style={s.courseThumb}>
      <Cover seed={course.id} motif={motifFor(course.name, course.id)} compact style={s.fill}/>
    </View>
    <View style={s.cardBody}>
      <Text style={s.kicker}>{course.modules.length === 1 ? '1 Modul' : course.modules.length + ' Module'} · {p.total === 1 ? '1 Lektion' : p.total + ' Lektionen'}</Text>
      <Text numberOfLines={2} style={s.courseTitle}>{name.title}</Text>
      <View style={s.courseMeta}>
        <ProgressBar value={p.ratio} style={{ flex: 1 }}/>
        <Text style={s.progressText}>{p.done}/{p.total}</Text>
      </View>
    </View>
    <Symbol name="chevron.right" size={12} tint={color.muted}/>
  </Pressy>;
}

function Locked({ closed, startDate }: { closed: boolean; startDate: string | null }) {
  const start = startDate ? new Date(startDate) : null;
  return <StateCard symbol={closed ? 'calendar' : 'lock.fill'} title={closed ? 'Bald geht es los' : 'Kein aktiver Zugang'}
    text={closed && start ? 'Die Mentorship startet am ' + start.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) + '. Wir sehen uns!' :
      'Mit diesem Konto ist gerade keine aktive Mentorship verbunden. Verwalte deine Mitgliedschaft auf der Website und ziehe hier anschließend zum Aktualisieren nach unten.'}
    action={<GlassButton prominent symbol="safari" label="Website öffnen" onPress={() => void Linking.openURL(API_ORIGIN + '/mentorship')}/>}/>;
}

function StateCard({ symbol, title, text, action }: { symbol: string; title: string; text: string; action?: ReactNode }) {
  return <View style={s.state}>
    <Glass style={s.stateOrb}><Symbol name={symbol as never} size={36} tint={color.accent}/></Glass>
    <Text style={s.stateTitle}>{title}</Text>
    <Text style={[s.body, { textAlign: 'center' }]}>{text}</Text>
    {action ? <View style={{ marginTop: 24, alignSelf: 'stretch', flexDirection: 'row' }}>{action}</View> : null}
  </View>;
}

/* ───────────── Kurs ───────────── */

export function CourseScreen({ id }: { id: string }) {
  const router = useRouter();
  const { courses, watched } = useAcademy();
  const course = courses.find(c => c.id === id);
  if (!course) return <Page><Missing/></Page>;
  const all = courseLessons(course);
  const p = progressOf(all, watched);
  const up = nextLesson(all, watched);
  // A review archive is read newest first: the button leads to the latest review, not back to March.
  const monthly = course.modules.length > 0 && course.modules.every(m => monthKey(m.name) !== null);
  const latest = monthly ? all.reduce<Lesson | undefined>((best, l) => !best || (dateKey(l.title) ?? 0) >= (dateKey(best.title) ?? 0) ? l : best, undefined) : undefined;
  const target = latest && !watched.has(latest.id) ? latest : up;
  return <Page refresh>
    <Stack.Screen options={{ title: splitName(course.name).title.replace(/\s*\(.*\)\s*$/, '') }}/>
    {course.description ? <Text style={s.body}>{course.description}</Text> : null}
    <View style={[s.progressCard, { marginTop: course.description ? 18 : 4 }]}>
      <View style={s.rowBetween}><Text style={s.progressLabel}>Kursfortschritt</Text><Text style={s.progressText}>{p.done} von {p.total} Lektionen</Text></View>
      <ProgressBar value={p.ratio}/>
      {target ? <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <GlassButton prominent compact symbol="play.fill" label={target === latest ? 'Neueste ansehen' : p.done ? 'Weiter: ' + lessonTitle(target.title) : 'Kurs starten'}
          onPress={() => router.push({ pathname: '/(mentorship)/lektion/[id]', params: { id: target.id } })}/>
      </View> : null}
    </View>
    <SectionTitle detail={course.modules.length + ' Module'}>Module</SectionTitle>
    <View style={{ gap: 12 }}>
      {course.modules.map((m, i) => <FadeIn key={m.id} delay={Math.min(i, 8) * 45}><ModuleCard mod={m} index={i + 1}
        onPress={() => { tick(); router.push({ pathname: '/(mentorship)/modul/[id]', params: { id: m.id } }); }}/></FadeIn>)}
    </View>
  </Page>;
}

function ModuleCard({ mod, index, onPress }: { mod: Module; index: number; onPress: () => void }) {
  const { watched, courses } = useAcademy();
  const lessons = moduleLessons(mod);
  const p = progressOf(lessons, watched);
  const complete = p.total > 0 && p.done === p.total;
  return <Pressy onPress={onPress} style={s.card} accessibilityLabel={'Modul ' + index + ': ' + mod.name}>
    <View style={s.thumb}>
      <Cover seed={mod.id} motif={motifOf(courses, mod.courseId)} index={String(index).padStart(2, '0')} compact style={s.fill}/>
    </View>
    <View style={s.cardBody}>
      <Text numberOfLines={2} style={s.cardTitle}>{splitName(mod.name).title}</Text>
      <Text style={s.metaText}>{p.total === 1 ? '1 Lektion' : p.total + ' Lektionen'}{complete ? '' : p.done ? ' · ' + p.done + ' erledigt' : ''}</Text>
      {complete ? <View style={s.meta}><Symbol name="checkmark.circle.fill" size={13} tint={color.accent}/><Text style={[s.metaText, { color: color.accent }]}>Abgeschlossen</Text></View> :
        <ProgressBar value={p.ratio} style={{ marginTop: 8 }}/>}
    </View>
    <Symbol name="chevron.right" size={13} tint={color.muted}/>
  </Pressy>;
}

/* ───────────── Modul ───────────── */

export function ModuleScreen({ id }: { id: string }) {
  const router = useRouter();
  const { modules, watched, courses } = useAcademy();
  const mod = modules.get(id);
  if (!mod) return <Page><Missing/></Page>;
  const lessons = moduleLessons(mod);
  const p = progressOf(lessons, watched);
  const up = nextLesson(lessons, watched);
  let n = 0;
  return <Page refresh glow="rgba(122,160,160,.14)">
    <Stack.Screen options={{ title: splitName(mod.name).title }}/>
    <View style={s.moduleHero}>
      <Cover seed={mod.id} motif={motifOf(courses, mod.courseId)} code={'M-' + (splitName(mod.name).number ?? '01')} title={splitName(mod.name).title} style={s.fill}/>
      <LinearGradient colors={['rgba(9,12,13,0)', 'rgba(9,12,13,.85)']} locations={[.4, 1]} style={StyleSheet.absoluteFill}/>
      <View style={s.moduleHeroBody}>
        <Chip onImage symbol="list.bullet" label={p.done + ' / ' + p.total + ' Lektionen'}/>
      </View>
    </View>
    {mod.description ? <Text style={[s.body, { marginTop: 18 }]}>{mod.description}</Text> : null}
    {up ? <View style={{ flexDirection: 'row', marginTop: 18 }}>
      <GlassButton prominent symbol="play.fill" label={p.done ? 'Fortsetzen' : 'Modul starten'}
        onPress={() => router.push({ pathname: '/(mentorship)/lektion/[id]', params: { id: up.id } })}/>
    </View> : null}
    {mod.chapters.map(chapter => <View key={chapter.id}>
      <SectionTitle detail={chapter.lessons.length === 1 ? '1 Lektion' : chapter.lessons.length + ' Lektionen'}>{chapter.name}</SectionTitle>
      <View style={s.group}>
        {chapter.lessons.map((lesson, i) => {
          n += 1;
          return <LessonRow key={lesson.id} lesson={lesson} number={n} done={watched.has(lesson.id)} last={i === chapter.lessons.length - 1}
            onPress={() => { tick(); router.push({ pathname: '/(mentorship)/lektion/[id]', params: { id: lesson.id } }); }}/>;
        })}
      </View>
    </View>)}
  </Page>;
}

function LessonRow({ lesson, number, context, done, last, onPress, active = false }: { lesson: Lesson; number?: number; context?: string; done: boolean; last: boolean; onPress: () => void; active?: boolean }) {
  const meta = [context, minutes(lesson.duration)].filter(Boolean).join('  ·  ');
  return <Pressable onPress={onPress} accessibilityLabel={lessonTitle(lesson.title) + (done ? ', angesehen' : '')}
    style={({ pressed }) => [s.row, pressed && { backgroundColor: 'rgba(255,255,255,.06)' }, active && { backgroundColor: 'rgba(231,131,112,.10)' }]}>
    <View style={[s.lessonBadge, done && s.lessonBadgeDone]}>
      {done ? <Symbol name="checkmark" size={12} tint="#1A0E0B"/> : number ? <Text style={s.lessonNumber}>{number}</Text> :
        <View style={{ marginLeft: 1 }}><Symbol name="play.fill" size={10} tint={color.muted}/></View>}
    </View>
    <View style={[s.rowMain, !last && s.rowLine]}>
      <View style={{ flex: 1, paddingVertical: 13 }}>
        <Text style={[s.rowLabel, done && { color: color.soft }]} numberOfLines={2}>{lessonTitle(lesson.title)}</Text>
        <View style={[s.meta, { marginTop: 3 }]}>
          {meta ? <Text style={s.metaText} numberOfLines={1}>{meta}</Text> : null}
          {lesson.pdfUrl ? <><Symbol name="doc.text" size={11} tint={color.muted}/><Text style={s.metaText}>PDF</Text></> : null}
        </View>
      </View>
      <Symbol name={active ? 'play.fill' : 'chevron.right'} size={12} tint={active ? color.accent : color.muted}/>
    </View>
  </Pressable>;
}

/* ───────────── Lektion ───────────── */

export function LessonScreen({ id }: { id: string }) {
  const router = useRouter();
  const academy = useAcademy();
  const lesson = academy.lessons.get(id);
  const mod = lesson ? academy.modules.get(lesson.moduleId) : undefined;
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const metrics = useRef<ScrollMetrics>({ y: 0, top: 0, bottom: 0, content: 0, viewport: 0 });
  const notesHeight = useRef(0);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (notesTimer.current) clearTimeout(notesTimer.current); }, []);
  // notesOpen is the target; notesMounted keeps the panel alive while it animates closed.
  const [notesMounted, setNotesMounted] = useState(false);
  function animateNotes(open: boolean) {
    if (open) setNotesMounted(true);
    setNotesOpen(open);
  }
  function toggleNotes() {
    if (!notesOpen) { animateNotes(true); return; }
    // Collapsing shortens the page. If we are scrolled past where the shorter page could end, the
    // scroll view would snap back and bounce like a pull-to-refresh. Glide there first, then collapse.
    const m = metrics.current;
    const maxAfter = m.content - notesHeight.current - m.viewport + m.bottom;
    const target = Math.max(-m.top, Math.min(m.y, maxAfter));
    if (target < m.y - 1) {
      scrollRef.current?.scrollTo({ y: target, animated: true });
      if (notesTimer.current) clearTimeout(notesTimer.current);
      notesTimer.current = setTimeout(() => animateNotes(false), 320);
    } else animateNotes(false);
  }
  const siblings = useMemo(() => mod ? moduleLessons(mod) : [], [mod]);
  const index = siblings.findIndex(l => l.id === id);
  const next = index >= 0 ? siblings[index + 1] : undefined;
  const prev = index > 0 ? siblings[index - 1] : undefined;
  const done = academy.watched.has(id);

  useEffect(() => {
    setUrl(''); setProblem(''); setNotesOpen(false); setNotesMounted(false);
    if (!lesson) return;
    academy.rememberLesson(lesson.id);
    // Load Bunny's player right away so its own poster frame shows; playback starts on tap inside the player.
    if (lesson.hasVideo) void play(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!lesson) return <Page><Missing/></Page>;

  async function play(autoplay = true) {
    setLoading(true); setProblem('');
    try { setUrl(await academy.playbackUrl(lesson!.id, autoplay)); }
    catch (e) { setProblem('Das Video lässt sich gerade nicht laden. Prüfe deine Verbindung und versuche es erneut.' + (e instanceof HttpError ? ' (Code ' + e.status + ')' : e instanceof Error ? ' (' + e.message + ')' : '')); }
    finally { setLoading(false); }
  }
  async function toggle(value: boolean, manual: boolean) {
    setSaving(true);
    try { await academy.setWatched(lesson!.id, value, manual); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }
    catch (e) { setProblem(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); }
    finally { setSaving(false); }
  }
  const go = (l: Lesson) => { tick(); router.replace({ pathname: '/(mentorship)/lektion/[id]', params: { id: l.id } }); };

  return <Page glow="rgba(122,160,160,.14)" scrollRef={scrollRef} metrics={metrics}>
    <Stack.Screen options={{ title: '' }}/>
    <View style={s.player}>
      {url ? <LessonPlayer url={url} onEnded={() => { if (!academy.watched.has(lesson.id)) void toggle(true, false); }}
        onError={() => { setUrl(''); setProblem('Die Wiedergabe wurde unterbrochen. Tippe erneut auf Play.'); }}/> :
        <Pressable style={s.poster} onPress={() => { tick(); void play(); }} disabled={loading || !lesson.hasVideo} accessibilityLabel={lesson.title + ' abspielen'}>
          {lesson.thumbnailUrl ? <Image source={{ uri: lesson.thumbnailUrl }} alt="" accessible={false} resizeMode="cover" style={s.fill}/> :
            <Cover seed={lesson.id} motif={motifOf(academy.courses, lesson.courseId)} code={'L-' + String(index + 1).padStart(2, '0')} title={lesson.chapterName} style={s.fill}/>}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,10,11,.4)' }]}/>
          {lesson.hasVideo ? <Glass interactive style={s.playOrb}>
            {loading ? <ActivityIndicator color={color.ink}/> : <View style={{ marginLeft: 3 }}><Symbol name="play.fill" size={22}/></View>}
          </Glass> : <Chip onImage symbol="doc.text" label="Lektion ohne Video"/>}
        </Pressable>}
    </View>
    {problem ? <Text accessibilityRole="alert" style={s.message}>{problem}</Text> : null}

    <View style={s.chips}>
      {mod ? <Chip accent label={splitName(mod.name).title}/> : null}
      {lesson.duration ? <Chip symbol="clock" label={minutes(lesson.duration)}/> : null}
      {done ? <Chip symbol="checkmark.circle.fill" label="Angesehen"/> : null}
    </View>
    <Text style={s.crumb}>{lesson.chapterName}{index >= 0 ? '  ·  Lektion ' + (index + 1) + ' von ' + siblings.length : ''}</Text>
    <Text accessibilityRole="header" style={s.lessonTitle}>{lessonTitle(lesson.title)}</Text>

    <View style={s.lessonActions}>
      <GlassButton busy={saving} symbol={done ? 'checkmark.circle.fill' : 'checkmark.circle'}
        label={done ? 'Erledigt' : 'Als erledigt markieren'} accessibilityLabel={done ? 'Erledigt, tippen um als offen zu markieren' : 'Als erledigt markieren'}
        onPress={() => void toggle(!done, true)}/>
      {lesson.showNotes ? <GlassButton symbol={notesOpen ? 'chevron.up' : 'text.alignleft'} accessibilityLabel={notesOpen ? 'Show Notes ausblenden' : 'Show Notes anzeigen'}
        onPress={toggleNotes}/> : null}
      {lesson.pdfUrl ? <GlassButton symbol="doc.text" accessibilityLabel="PDF öffnen"
        onPress={() => router.push({ pathname: '/(mentorship)/pdf/[id]', params: { id: lesson.id } })}/> : null}
    </View>

    {lesson.showNotes && notesMounted ? <NotesPanel key={lesson.id} text={lesson.showNotes} open={notesOpen} onClosed={() => setNotesMounted(false)} onHeight={h => { notesHeight.current = h; }}/> : null}

    {(prev || next) ? <View style={s.stepper}>
      {prev ? <StepCard label="Zurück" lesson={prev} onPress={() => go(prev)} align="left" wide={!next}/> : null}
      {next ? <StepCard label="Nächste Lektion" lesson={next} onPress={() => go(next)} align="right" wide={!prev}/> : null}
    </View> : null}

    {mod ? <>
      <SectionTitle detail={siblings.length + ' Lektionen'}>{splitName(mod.name).title}</SectionTitle>
      <View style={s.group}>
        {siblings.map((l, i) => <LessonRow key={l.id} lesson={l} number={i + 1} done={academy.watched.has(l.id)} last={i === siblings.length - 1}
          active={l.id === id} onPress={() => { if (l.id !== id) go(l); }}/>)}
      </View>
    </> : null}
  </Page>;
}

/**
 * Show notes card. Opening fades and rises on the native driver. Closing fades the text out natively,
 * then swaps it for an empty box that folds to zero, so no long text is re-laid out per frame and the
 * scroll view never jumps (the old global LayoutAnimation made the whole page bounce).
 */
function NotesPanel({ text, open, onClosed, onHeight }: { text: string; open: boolean; onClosed: () => void; onHeight: (height: number) => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const fold = useRef(new Animated.Value(1)).current;
  const height = useRef(0);
  const [folding, setFolding] = useState(false);
  useEffect(() => {
    if (open) { fold.stopAnimation(); fold.setValue(1); setFolding(false); }
    const anim = open
      ? Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.bezier(.2, .8, .2, 1), useNativeDriver: true })
      : Animated.timing(fade, { toValue: 0, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true });
    anim.start(({ finished }) => { if (finished && !open) setFolding(true); });
    return () => anim.stop();
  }, [open, fade, fold]);
  useEffect(() => {
    if (!folding) return;
    Animated.timing(fold, { toValue: 0, duration: 280, easing: Easing.bezier(.4, 0, .2, 1), useNativeDriver: false })
      .start(({ finished }) => { if (finished) onClosed(); });
  }, [folding]); // eslint-disable-line react-hooks/exhaustive-deps
  if (folding) return <Animated.View style={{ height: fold.interpolate({ inputRange: [0, 1], outputRange: [0, Math.min(height.current, 900)] }) }}/>;
  return <Animated.View onLayout={e => { height.current = e.nativeEvent.layout.height + 14; onHeight(height.current); }}
    style={[s.notes, { marginTop: 14, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
    <Text style={s.notesTitle}>Show Notes</Text>
    <View style={{ height: 10 }}/>
    <Markdown text={text}/>
  </Animated.View>;
}

function StepCard({ label, lesson, onPress, align, wide = false }: { label: string; lesson: Lesson; onPress: () => void; align: 'left' | 'right'; wide?: boolean }) {
  // Alone in its row the card spans the width and reads like a list row: text left, direction at the edge.
  if (wide) return <Pressy onPress={onPress} containerStyle={{ flex: 1 }} style={[s.step, { flexDirection: align === 'left' ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }]} accessibilityLabel={label + ': ' + lessonTitle(lesson.title)}>
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={s.stepLabel}>{label}</Text>
      <Text style={s.stepTitle} numberOfLines={1}>{lessonTitle(lesson.title)}</Text>
    </View>
    <Symbol name={align === 'left' ? 'chevron.left' : 'chevron.right'} size={13} tint={color.accent}/>
  </Pressy>;
  return <Pressy onPress={onPress} containerStyle={{ flex: 1 }} style={s.step} accessibilityLabel={label + ': ' + lessonTitle(lesson.title)}>
    <View style={[s.meta, align === 'right' && { flexDirection: 'row-reverse' }]}>
      <Symbol name={align === 'left' ? 'chevron.left' : 'chevron.right'} size={11} tint={color.accent}/>
      <Text style={s.stepLabel}>{label}</Text>
    </View>
    <Text style={[s.stepTitle, align === 'right' && { textAlign: 'right' }]} numberOfLines={2}>{lessonTitle(lesson.title)}</Text>
  </Pressy>;
}

/* ───────────── PDF ───────────── */

export function PdfScreen({ id }: { id: string }) {
  const academy = useAcademy();
  const lesson = academy.lessons.get(id);
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => { void academy.authHeaders().then(setHeaders); }, [academy]);
  if (!lesson?.pdfUrl) return <Page><Missing/></Page>;
  return <View style={s.screen}>
    <Stack.Screen options={{ title: lesson.title, headerLargeTitle: false }}/>
    {headers ? <WebView source={{ uri: lesson.pdfUrl, headers }} style={{ flex: 1, backgroundColor: color.page }}
      startInLoadingState renderLoading={() => <ActivityIndicator color={color.accent} style={StyleSheet.absoluteFill}/>}/> :
      <ActivityIndicator color={color.accent} style={{ marginTop: 120 }}/>}
  </View>;
}

function Missing() {
  return <StateCard symbol="questionmark.circle" title="Nicht gefunden" text="Dieser Inhalt ist nicht mehr verfügbar. Zieh auf der Startseite nach unten, um die Mentorship zu aktualisieren."/>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.page },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 },
  ambient: { position: 'absolute', top: -300, left: 0, right: 0, height: 760 },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  pressed: { opacity: .9, transform: [{ scale: .985 }] },
  notice: { color: color.accent, fontFamily: font.body, fontSize: 14, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { fontFamily: font.body, color: color.soft, fontSize: 14.5, lineHeight: 21 },

  hero: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: color.surface, justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.12)' },
  heroArt: { aspectRatio: 1.6, width: '100%' },
  heroTop: { position: 'absolute', left: 12, top: 12 },
  heroBody: { padding: 16, paddingTop: 14 },
  kicker: { fontFamily: font.mono, color: color.accent, fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase' },
  heroTitle: { fontFamily: font.title, color: color.ink, fontSize: 25, lineHeight: 30, letterSpacing: -.7, marginTop: 4 },
  heroText: { fontFamily: font.body, color: color.soft, fontSize: 13.5, lineHeight: 19, marginTop: 6, opacity: .9 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 14 },

  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 12, borderRadius: 22, borderCurve: 'continuous', backgroundColor: color.surface },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: font.title, color: color.ink, fontSize: 21, lineHeight: 26, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: font.body, color: color.muted, fontSize: 12, lineHeight: 16 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: color.line },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileBox: { width: '48.5%' },
  tile: { flex: 1, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: color.surface },
  tileArt: { aspectRatio: 1.7 },
  tileBody: { padding: 12, paddingTop: 10 },
  tileTitle: { fontFamily: font.title, color: color.ink, fontSize: 15, lineHeight: 19, marginTop: 3 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, paddingRight: 12, borderRadius: 18, borderCurve: 'continuous', backgroundColor: color.surface },
  courseThumb: { width: 104, aspectRatio: 1.6, overflow: 'hidden' },
  courseCard: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: color.surface },
  courseArt: { aspectRatio: 1.6, backgroundColor: '#0A0D0E' },
  courseIcon: { position: 'absolute', left: 16, bottom: 12, width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  courseIconImg: { width: 34, height: 34 },
  courseBody: { padding: 14, paddingTop: 12, gap: 6 },
  courseTitle: { fontFamily: font.title, color: color.ink, fontSize: 17, lineHeight: 21, letterSpacing: -.3, marginTop: 2 },
  courseText: { fontFamily: font.body, color: color.soft, fontSize: 13, lineHeight: 18 },
  courseMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  progressText: { fontFamily: font.bold, color: color.soft, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  progressLabel: { fontFamily: font.bold, color: color.ink, fontSize: 13.5 },
  progressCard: { gap: 12, padding: 18, borderRadius: 22, borderCurve: 'continuous', backgroundColor: color.surface },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, paddingRight: 12, borderRadius: 18, borderCurve: 'continuous', backgroundColor: color.surface },
  thumb: { width: 96, aspectRatio: 1.6, overflow: 'hidden', backgroundColor: '#0A0D0E' },
  thumbChip: { position: 'absolute', left: 6, bottom: 6 },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { fontFamily: font.bold, color: color.ink, fontSize: 14.5, lineHeight: 19, letterSpacing: -.1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontFamily: font.body, color: color.muted, fontSize: 12.5 },

  moduleHero: { aspectRatio: 16 / 9, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: color.surface, justifyContent: 'flex-end' },
  moduleHeroBody: { padding: 14 },

  group: { borderRadius: 22, borderCurve: 'continuous', backgroundColor: color.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 12, paddingRight: 16, alignSelf: 'stretch' },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  rowLabel: { fontFamily: font.body, color: color.ink, fontSize: 14, lineHeight: 19 },
  lessonBadge: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  lessonBadgeDone: { backgroundColor: color.accent, borderColor: color.accent },
  lessonNumber: { fontFamily: font.bold, color: color.muted, fontSize: 12, fontVariant: ['tabular-nums'] },

  player: { aspectRatio: 16 / 9, width: '100%', borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#07090A',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.14)' },
  poster: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playOrb: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center' },
  message: { fontFamily: font.body, color: '#F1AA96', fontSize: 14, lineHeight: 20, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  crumb: { fontFamily: font.mono, color: color.muted, fontSize: 10.5, letterSpacing: .6, textTransform: 'uppercase', marginTop: 14 },
  lessonTitle: { fontFamily: font.title, color: color.ink, fontSize: 23, lineHeight: 28, letterSpacing: -.6, marginTop: 4 },
  lessonActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  notesWrap: { marginTop: 14, gap: 8 },
  notesToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingRight: 16, borderRadius: 18, borderCurve: 'continuous', backgroundColor: color.surface },
  notesToggleOpen: { backgroundColor: 'rgba(231,131,112,.10)' },
  notesIcon: { width: 32, height: 32, borderRadius: 10, borderCurve: 'continuous', backgroundColor: 'rgba(231,131,112,.14)', alignItems: 'center', justifyContent: 'center' },
  notesTitle: { fontFamily: font.bold, color: color.ink, fontSize: 14.5 },
  notes: { padding: 16, paddingBottom: 4, borderRadius: 20, borderCurve: 'continuous', backgroundColor: color.surface },
  stepper: { flexDirection: 'row', gap: 10, marginTop: 14 },
  step: { flex: 1, padding: 14, gap: 6, borderRadius: 20, borderCurve: 'continuous', backgroundColor: color.surface },
  stepLabel: { fontFamily: font.mono, color: color.accent, fontSize: 10, letterSpacing: .8, textTransform: 'uppercase' },
  stepTitle: { fontFamily: font.bold, color: color.ink, fontSize: 13, lineHeight: 17 },

  state: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 12 },
  stateOrb: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  stateTitle: { fontFamily: font.title, color: color.ink, fontSize: 22, lineHeight: 28, letterSpacing: -.8, marginBottom: 8, textAlign: 'center' },
});
