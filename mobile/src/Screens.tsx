import React, { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useClerk, useUser } from '@clerk/expo';
import { API_ORIGIN, useAcademy } from './academy';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { clock, fileSize, films, type Film, type Progress } from './catalog';
import * as media from './media';
import Player from './Player';
import { useStore } from './store';
import { Ambient, Chip, Glass, GlassButton, ProgressBar, SectionTitle, Symbol, radius, tick } from './glass';
import { color, font } from './ui';

const cover = require('../assets/art/fvg-cover.jpg');
const pad = 20;

function resumeOf(film: Film, progress?: Progress) {
  if (!progress || progress.seen || progress.seconds < 2 || progress.seconds >= film.duration - 1) return 0;
  return progress.seconds;
}

function Screen({ children, ambient }: { children: ReactNode; ambient?: string }) {
  // The ScrollView must be the screen's first native child so the iOS large title can collapse into the glass header.
  return <ScrollView style={s.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    {ambient ? <View pointerEvents="none" style={s.ambient}><Ambient glow={ambient} height={760}/></View> : null}
    {children}
  </ScrollView>;
}

/* ───────────── Mediathek ───────────── */

export function LibraryScreen() {
  const router = useRouter();
  const { journal, saved, notice } = useStore();
  const featured = films[0];
  const resume = resumeOf(featured, journal[featured.id]);
  const seenCount = films.filter(f => journal[f.id]?.seen).length;
  const open = (film: Film, play = false) => { tick(); router.push({ pathname: '/filme/[id]', params: { id: film.id, ...(play ? { play: '1' } : {}) } }); };

  return <Screen ambient="rgba(231,131,112,.20)">
    {notice ? <Text accessibilityRole="alert" style={s.notice}>{notice}</Text> : null}

    <Pressable onPress={() => open(featured)} accessibilityLabel={featured.title + ' öffnen'} style={({ pressed }) => [s.hero, pressed && s.pressed]}>
      <Image source={cover} alt="" accessible={false} resizeMode="cover" style={s.heroImage}/>
      <LinearGradient colors={['rgba(23,29,32,0)', 'rgba(23,29,32,.7)', color.surface]} locations={[.3, .52, .68]} style={StyleSheet.absoluteFill}/>
      <View style={s.heroTop}><Chip onImage symbol="sparkles" label="Neu im Archiv"/></View>
      <View style={s.heroBody}>
        <Text style={s.kicker}>{featured.topic}</Text>
        <Text style={s.heroTitle}>{featured.title}</Text>
        <Text numberOfLines={2} style={s.heroText}>{featured.description}</Text>
        {resume ? <View style={s.heroProgress}>
          <ProgressBar value={resume / featured.duration} style={{ flex: 1 }}/>
          <Text style={s.progressText}>{clock(featured.duration - resume)} übrig</Text>
        </View> : null}
        <View style={s.heroActions}>
          <GlassButton prominent symbol="play.fill" label={resume ? 'Fortsetzen' : 'Ansehen · ' + clock(featured.duration)} onPress={() => open(featured, true)}/>
          <GlassButton symbol={saved.includes(featured.id) ? 'checkmark' : 'arrow.down'} onPress={() => open(featured)}
            accessibilityLabel={saved.includes(featured.id) ? 'Offline verfügbar' : 'Details und Download'}/>
        </View>
      </View>
    </Pressable>

    <View style={s.stats}>
      <Stat value={String(films.length)} label="Filme"/>
      <View style={s.statDivider}/>
      <Stat value={String(seenCount)} label="Angesehen"/>
      <View style={s.statDivider}/>
      <Stat value={String(saved.length)} label="Offline"/>
    </View>

    <SectionTitle detail={films.length + ' Filme'}>Alle Filme</SectionTitle>
    <View style={{ gap: 12 }}>
      {films.map(film => <FilmCard key={film.id} film={film} progress={journal[film.id]} offline={saved.includes(film.id)} onPress={() => open(film)}/>)}
    </View>
  </Screen>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>;
}

function FilmCard({ film, progress, offline, onPress, trailing }: {
  film: Film; progress?: Progress; offline: boolean; onPress: () => void; trailing?: ReactNode;
}) {
  const resume = resumeOf(film, progress);
  return <Pressable onPress={onPress} accessibilityLabel={film.title + ' öffnen'} style={({ pressed }) => [s.card, pressed && s.pressed]}>
    <View style={s.thumb}>
      <Image source={film.still} alt="" accessible={false} resizeMode="cover" style={s.fill}/>
      <View style={s.thumbChip}><Chip onImage label={clock(film.duration)}/></View>
    </View>
    <View style={s.cardBody}>
      <Text style={s.cardKicker}>{film.topic}</Text>
      <Text numberOfLines={2} style={s.cardTitle}>{film.title}</Text>
      {resume ? <ProgressBar value={resume / film.duration} style={{ marginTop: 9 }}/> :
        <View style={s.cardMeta}>
          {progress?.seen ? <Meta symbol="checkmark.circle.fill" label="Angesehen" accent/> : null}
          {offline ? <Meta symbol="arrow.down.circle.fill" label="Offline"/> : null}
          {!progress?.seen && !offline ? <Meta symbol="film" label="Studienfilm"/> : null}
        </View>}
    </View>
    {trailing ?? <Symbol name="chevron.right" size={13} tint={color.muted}/>}
  </Pressable>;
}

function Meta({ symbol, label, accent = false }: { symbol: SFSymbol; label: string; accent?: boolean }) {
  const tint = accent ? color.accent : color.muted;
  return <View style={s.meta}><Symbol name={symbol} size={12} tint={tint}/><Text style={[s.metaText, { color: tint }]}>{label}</Text></View>;
}

/* ───────────── Film ───────────── */

export function FilmScreen({ id, autoplay }: { id: string; autoplay: boolean }) {
  const film = films.find(f => f.id === id);
  const store = useStore();
  const [requested, setRequested] = useState(false);
  const [uri, setUri] = useState('');
  const [problem, setProblem] = useState(false);
  const [initialTime, setInitialTime] = useState(0);
  const progress = film ? store.journal[film.id] : undefined;

  useEffect(() => {
    if (!film || !requested) return;
    let active = true;
    let release = () => {};
    void media.playback(film).then(source => {
      if (!active) { source.release(); return; }
      release = source.release;
      setUri(source.uri);
    }).catch(() => { if (active) { setRequested(false); setProblem(true); } });
    return () => { active = false; release(); };
  }, [film, requested]);

  useEffect(() => { if (autoplay && store.ready) play(); }, [autoplay, store.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!film) return <Screen><Text style={s.body}>Dieser Film ist nicht mehr verfügbar.</Text></Screen>;
  const saved = store.saved.includes(film.id);
  const busy = store.busy.includes(film.id);
  const resume = resumeOf(film, progress);
  const message = store.errors[film.id];

  function play() {
    setProblem(false);
    setInitialTime(resumeOf(film!, store.journal[film!.id]));
    setRequested(true);
  }
  function stop() { setRequested(false); setUri(''); }

  return <Screen ambient="rgba(122,160,160,.16)">
    <View style={s.player}>
      {requested && uri ? <Player uri={uri} title={film.title} initialTime={initialTime}
        onPosition={seconds => store.progressAt(film, seconds)}
        onEnd={() => store.update(film.id, { seen: true, seconds: 0 })}
        onError={() => { stop(); setProblem(true); }}/> :
        <Pressable style={s.poster} onPress={() => { tick(); play(); }} disabled={requested} accessibilityLabel={film.title + ' abspielen'}>
          <Image source={film.still} alt="" accessible={false} resizeMode="cover" style={s.fill}/>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,10,11,.28)' }]}/>
          <Glass interactive style={s.playOrb}>
            {requested ? <ActivityIndicator color={color.ink}/> : <View style={{ marginLeft: 4 }}><Symbol name="play.fill" size={28}/></View>}
          </Glass>
          {resume ? <View style={s.posterResume}><Chip onImage symbol="clock" label={'Weiter bei ' + clock(resume)}/></View> : null}
        </Pressable>}
    </View>
    {problem ? <Text accessibilityRole="alert" style={s.message}>Der Film lässt sich gerade nicht laden. Prüfe die Verbindung und tippe erneut auf Play.</Text> : null}

    <View style={s.chips}>
      <Chip accent label={film.topic}/>
      <Chip symbol="clock" label={clock(film.duration) + ' min'}/>
      <Chip symbol="speaker.slash" label="Ohne Ton"/>
    </View>
    <Text accessibilityRole="header" style={s.detailTitle}>{film.title}</Text>
    <Text style={s.body}>{film.description}</Text>

    {resume ? <View style={s.detailProgress}>
      <View style={s.rowBetween}><Text style={s.progressLabel}>Dein Fortschritt</Text><Text style={s.progressText}>{clock(resume)} / {clock(film.duration)}</Text></View>
      <ProgressBar value={resume / film.duration}/>
    </View> : null}

    <View style={s.detailActions}>
      <GlassButton prominent={!saved} busy={busy} disabled={!store.ready}
        symbol={saved ? 'trash' : 'arrow.down'}
        label={saved ? 'Download entfernen' : busy ? 'Wird gespeichert …' : 'Offline speichern'}
        onPress={() => { if (saved) stop(); void store.changeDownload(film, saved); }}/>
      <GlassButton symbol={progress?.seen ? 'checkmark.circle.fill' : 'checkmark.circle'} disabled={!store.ready}
        accessibilityLabel={progress?.seen ? 'Als nicht angesehen markieren' : 'Als angesehen markieren'}
        onPress={() => store.toggleSeen(film)}/>
    </View>
    {message ? <Text accessibilityRole="alert" style={s.message}>{message}</Text> : null}

    <SectionTitle>Details</SectionTitle>
    <Group>
      <Row symbol="clock" label="Länge" value={clock(film.duration) + ' min'}/>
      <Row symbol="internaldrive" label="Größe" value={fileSize(film.bytes)}/>
      <Row symbol="text.bubble" label="Einblendungen" value="Englisch"/>
      <Row symbol={saved ? 'checkmark.icloud' : 'icloud'} label="Status" value={saved ? 'Auf diesem iPhone' : 'Stream'} last/>
    </Group>
  </Screen>;
}

/* ───────────── Zugang ───────────── */

export function AccountScreen() {
  const academy = useAcademy();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [error, setError] = useState(false);
  const open = (url: string) => { setError(false); void Linking.openURL(url).catch(() => setError(true)); };
  const name = user?.fullName || user?.firstName || 'PAT Mitglied';
  const mail = user?.primaryEmailAddress?.emailAddress ?? '';
  const allLessons = academy.courses.reduce((n, c) => n + c.modules.reduce((m, mod) => m + mod.chapters.reduce((k, ch) => k + ch.lessons.length, 0), 0), 0);
  const status = academy.access === 'member' ? 'Aktiv' : academy.access === 'locked' ? 'Nicht aktiv' : academy.access === 'closed' ? 'Startet bald' : '–';
  function confirmSignOut() {
    Alert.alert('Abmelden?', 'Du kannst dich jederzeit mit deiner E-Mail wieder anmelden.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: () => { tick(); void signOut(); } },
    ]);
  }
  return <Screen ambient="rgba(231,131,112,.16)">
    <View style={s.profile}>
      <View style={s.avatar}>{user?.imageUrl ? <Image source={{ uri: user.imageUrl }} alt="" accessible={false} resizeMode="cover" style={s.fill}/> :
        <Text style={s.initial}>{name.slice(0, 1)}</Text>}</View>
      <Text style={s.profileName}>{name}</Text>
      {mail ? <Text style={s.statLabel}>{mail}</Text> : null}
      <View style={{ marginTop: 12 }}><Chip accent symbol={academy.access === 'member' ? 'checkmark.seal.fill' : 'lock'} label={'Mentorship · ' + status}/></View>
    </View>

    <SectionTitle>Mitgliedschaft</SectionTitle>
    <Group>
      <Row symbol="person.crop.circle" label="Status" value={status}/>
      {academy.access === 'member' ? <Row symbol="graduationcap" label="Lektionen" value={academy.watched.size + ' von ' + allLessons}/> : null}
      <Row symbol="creditcard" label="Abo verwalten" onPress={() => open(API_ORIGIN + '/dashboard')}/>
      <Row symbol="safari" label="Mentorship im Web" onPress={() => open(API_ORIGIN + '/mentorship')} last/>
    </Group>
    {error ? <Text accessibilityRole="alert" style={s.message}>Der Browser konnte nicht geöffnet werden. Du findest alles unter www.price-action-trader.de.</Text> : null}

    <SectionTitle>App</SectionTitle>
    <Group>
      <Row symbol="info.circle" label="Version" value="0.2 Beta" last/>
    </Group>

    <View style={{ marginTop: 28, flexDirection: 'row' }}>
      <GlassButton destructive symbol="rectangle.portrait.and.arrow.right" label="Abmelden" onPress={confirmSignOut}/>
    </View>
    <Text style={s.footnote}>Fortschritt in der Mentorship wird mit deinem Konto auf der Website synchronisiert. </Text>
  </Screen>;
}

/* ───────────── Grouped list ───────────── */

function Group({ children }: { children: ReactNode }) {
  return <View style={s.group}>{children}</View>;
}

function Row({ symbol, label, value, onPress, last = false, danger = false }: { symbol: SFSymbol; label: string; value?: string; onPress?: () => void; last?: boolean; danger?: boolean }) {
  const inner = <>
    <View style={s.rowIcon}><Symbol name={symbol} size={15} tint={danger ? '#F1AA96' : color.accent}/></View>
    <View style={[s.rowMain, !last && s.rowLine]}>
      <Text style={[s.rowLabel, danger && { color: '#F1AA96' }]}>{label}</Text>
      {value ? <Text style={s.rowValue}>{value}</Text> : null}
      {onPress && !danger ? <Symbol name={value ? 'chevron.right' : 'arrow.up.right'} size={12} tint={color.muted}/> : null}
    </View>
  </>;
  if (!onPress) return <View style={s.row} accessible accessibilityLabel={label + (value ? ', ' + value : '')}>{inner}</View>;
  return <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => { tick(); onPress(); }}
    style={({ pressed }) => [s.row, pressed && { backgroundColor: 'rgba(255,255,255,.06)' }]}>{inner}</Pressable>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.page },
  ambient: { position: 'absolute', top: -300, left: 0, right: 0, height: 760 },
  content: { paddingHorizontal: pad, paddingTop: 8, paddingBottom: 48 },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  pressed: { opacity: .9, transform: [{ scale: .985 }] },
  notice: { color: color.accent, fontFamily: font.body, fontSize: 14, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  hero: { aspectRatio: 1, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: color.surface, justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.12)' },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, height: '66%', width: '100%' },
  heroTop: { padding: 16 },
  heroBody: { padding: 20, paddingTop: 0 },
  kicker: { fontFamily: font.bold, color: color.accent, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  heroTitle: { fontFamily: font.title, color: color.ink, fontSize: 26, lineHeight: 31, letterSpacing: -1.6, marginTop: 6 },
  heroText: { fontFamily: font.body, color: color.soft, fontSize: 15, lineHeight: 21, marginTop: 8, opacity: .9 },
  heroProgress: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  progressText: { fontFamily: font.bold, color: color.soft, fontSize: 12, fontVariant: ['tabular-nums'] },
  progressLabel: { fontFamily: font.bold, color: color.ink, fontSize: 14 },

  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingVertical: 16, borderRadius: 22, borderCurve: 'continuous', backgroundColor: color.surface },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: font.title, color: color.ink, fontSize: 21, lineHeight: 26, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: font.body, color: color.muted, fontSize: 12.5, lineHeight: 17 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: color.line },

  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, paddingRight: 14, borderRadius: 22, borderCurve: 'continuous', backgroundColor: color.surface },
  thumb: { width: 124, aspectRatio: 16 / 10, borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#0A0D0E' },
  thumbChip: { position: 'absolute', right: 6, bottom: 6 },
  cardBody: { flex: 1, minWidth: 0 },
  cardKicker: { fontFamily: font.bold, color: color.accent, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  cardTitle: { fontFamily: font.bold, color: color.ink, fontSize: 14.5, lineHeight: 19, marginTop: 3, letterSpacing: -.2 },
  cardMeta: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontFamily: font.body, fontSize: 12.5 },

  player: { aspectRatio: 16 / 9, width: '100%', borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#07090A',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.14)' },
  poster: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playOrb: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
  posterResume: { position: 'absolute', left: 12, bottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22 },
  detailTitle: { fontFamily: font.title, color: color.ink, fontSize: 26, lineHeight: 31, letterSpacing: -1.5, marginTop: 14, marginBottom: 10 },
  body: { fontFamily: font.body, color: color.soft, fontSize: 14.5, lineHeight: 21 },
  detailProgress: { marginTop: 20, gap: 10, padding: 16, borderRadius: 20, borderCurve: 'continuous', backgroundColor: color.surface },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  message: { fontFamily: font.body, color: '#F1AA96', fontSize: 14, lineHeight: 20, marginTop: 12 },

  group: { borderRadius: 22, borderCurve: 'continuous', backgroundColor: color.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, minHeight: 52 },
  rowIcon: { width: 30, height: 30, borderRadius: 9, borderCurve: 'continuous', backgroundColor: 'rgba(231,131,112,.14)', alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12, paddingRight: 16, alignSelf: 'stretch' },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  rowLabel: { flex: 1, fontFamily: font.body, color: color.ink, fontSize: 14.5 },
  rowValue: { fontFamily: font.body, color: color.muted, fontSize: 13.5, fontVariant: ['tabular-nums'] },

  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 12 },
  emptyOrb: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  emptyTitle: { fontFamily: font.title, color: color.ink, fontSize: 22, lineHeight: 28, letterSpacing: -.8, marginBottom: 8 },
  storage: { gap: 12, padding: 18, borderRadius: 22, borderCurve: 'continuous', backgroundColor: color.surface },
  storageTitle: { fontFamily: font.bold, color: color.ink, fontSize: 15 },

  profile: { alignItems: 'center', paddingTop: 12 },
  initial: { fontFamily: font.title, color: color.ink, fontSize: 40, lineHeight: 74, textAlign: 'center' },
  avatar: { width: 76, height: 76, borderRadius: 38, overflow: 'hidden', backgroundColor: color.surface, marginBottom: 14,
    borderWidth: 2, borderColor: 'rgba(231,131,112,.6)' },
  profileName: { fontFamily: font.title, color: color.ink, fontSize: 22, lineHeight: 28, letterSpacing: -.8 },
  footnote: { fontFamily: font.body, color: color.muted, fontSize: 13, lineHeight: 19, marginTop: 12, paddingHorizontal: 6 },
});
