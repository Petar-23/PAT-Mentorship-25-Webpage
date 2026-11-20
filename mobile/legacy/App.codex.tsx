import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { films, type Film, type Journal, type Progress } from './catalog';
import * as media from './media';
import { Account, Detail, Downloads, Library } from './Screens';
import { color, font, Icon, Tap, Wordmark, type IconName } from './ui';

type Tab = 'library' | 'downloads' | 'account';
const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'library', label: 'Mediathek', icon: 'shelf' },
  { id: 'downloads', label: 'Downloads', icon: 'download' },
  { id: 'account', label: 'Zugang', icon: 'account' },
];

function Mentorship() {
  const [tab, setTab] = useState<Tab>('library');
  const [film, setFilm] = useState<Film | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState<string[]>([]);
  const jobs = useRef(new Set<string>());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [storageNotice, setStorageNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [journal, setJournal] = useState<Journal>({});
  const latest = useRef<Journal>({});
  const writes = useRef(Promise.resolve());
  const { width, height } = useWindowDimensions();
  const landscape = width > height && height <= 575;
  const webFrame = Platform.OS === 'web' && width >= 580 && !landscape;
  useEffect(() => {
    let alive = true;
    const restore = async () => {
      const checks = await Promise.allSettled(films.map(media.isSaved));
      const progress = await media.readJournal().catch(() => ({}));
      if (!alive) return;
      setSaved(films.filter((_, i) => checks[i].status === 'fulfilled' && checks[i].value).map(item => item.id));
      if (checks.some(item => item.status === 'rejected')) setStorageNotice('Der Gerätespeicher ist gerade nicht verfügbar.');
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
      setStorageNotice('Der Lernstand konnte auf diesem Gerät nicht gespeichert werden.');
    });
  }
  function progressAt(item: Film, seconds: number) {
    if (!Number.isFinite(seconds)) return;
    const prev = latest.current[item.id] ?? { seen: false, seconds: 0 };
    if (Math.abs(prev.seconds - seconds) >= 2) update(item.id, { ...prev, seconds: Math.floor(seconds) });
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
    } catch {
      setErrors(old => ({...old, [item.id]: remove ? 'Der Download konnte nicht entfernt werden. Versuche es erneut.' :
        'Speichern fehlgeschlagen. Prüfe Verbindung und freien Speicher und versuche es erneut.'}));
    } finally {
      jobs.current.delete(item.id);
      setBusy([...jobs.current]);
    }
  }
  function navigate(destination: Tab) { setFilm(null); setTab(destination); }
  const parent = tabs.find(item => item.id === tab)!;
  const horizontalPadding = width < 365 ? 19 : 24;
  return <View style={s.stage}>
    <SafeAreaView edges={['top','bottom','left','right']} style={[s.app, webFrame && s.desktop, landscape && { maxWidth: 860 }]}>
      <StatusBar style="light"/>
      <View style={[s.header, { paddingHorizontal: horizontalPadding }]}>
        {film ? <Tap style={s.back} accessibilityLabel={'Zurück zu ' + parent.label} onPress={() => setFilm(null)}>
          <Icon name="back" size={20}/><Text style={s.backText}>{parent.label}</Text>
        </Tap> : <Wordmark/>}
        <View style={s.preview}><View style={s.previewDot}/><Text style={s.previewText}>Vorschau</Text></View>
      </View>
      <ScrollView key={film?.id ?? tab} style={s.scroll} contentContainerStyle={[s.content, { paddingHorizontal: horizontalPadding }, film && { paddingTop: 13 }]}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {storageNotice ? <Text accessibilityRole="alert" style={s.notice}>{storageNotice}</Text> : null}
        {film ? <Detail film={film} progress={journal[film.id]} saved={saved.includes(film.id)} hydrated={ready} busy={busy.includes(film.id)} message={errors[film.id]}
          onPosition={seconds => progressAt(film, seconds)}
          onEnd={() => update(film.id, { seen: true, seconds: 0 })}
          onToggle={() => update(film.id, { seconds: latest.current[film.id]?.seconds ?? 0, seen: !latest.current[film.id]?.seen })}
          onDownload={() => void changeDownload(film, false)} onRemove={() => void changeDownload(film, true)}/> :
          tab === 'library' ? <Library films={films} progress={journal} open={setFilm}/> :
          tab === 'downloads' ? <Downloads films={films.filter(item => saved.includes(item.id))} open={setFilm} goLibrary={() => navigate('library')} loading={!ready}/> :
          <Account/>}
      </ScrollView>
      <View style={s.tabBar} accessibilityRole="tablist">
        {tabs.map(item => {
          const selected = tab === item.id;
          const tint = selected ? color.accent : color.muted;
          return <Tap key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected}}
            onPress={() => navigate(item.id)} style={s.tab}>
            <Icon name={item.icon} size={21} tint={tint}/><Text style={[s.tabText, {color: tint}]}>{item.label}</Text>
          </Tap>;
        })}
      </View>
    </SafeAreaView>
  </View>;
}

export default function App() {
  const [fontsReady, fontError] = useFonts({
    PATSerif: require('../assets/fonts/PATSerif-Semibold.ttf'),
    PATSans: require('../assets/fonts/PATSansStudio-Regular.ttf'),
    PATSansSemibold: require('../assets/fonts/PATSansStudio-Semibold.ttf'),
  });
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    {fontsReady || fontError ? <Mentorship/> : <View style={s.splash}><ActivityIndicator color={color.accent} accessibilityLabel="Mediathek wird geladen"/></View>}
  </SafeAreaProvider>;
}

const s = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', backgroundColor: color.stage },
  app: { backgroundColor: color.page, flex: 1, width: '100%' },
  desktop: { maxWidth: 466, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#252B2C' },
  header: { paddingTop: 9, paddingBottom: 8, minHeight: 65, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: color.line },
  previewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.accent },
  previewText: { color: color.soft, fontFamily: font.body, fontSize: 11, lineHeight: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44 },
  backText: { color: color.ink, fontFamily: font.bold, fontSize: 15 },
  scroll: { flex: 1 }, content: { paddingTop: 13, paddingBottom: 32 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: color.line, paddingVertical: 5, backgroundColor: color.page },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 2, minHeight: 53, flex: 1 },
  tabText: { fontFamily: font.bold, fontSize: 11, lineHeight: 15 },
  notice: { color: color.accent, fontFamily: font.body, fontSize: 14, marginVertical: 5 },
  splash: { flex: 1, backgroundColor: color.page, alignItems: 'center', justifyContent: 'center' },
});
