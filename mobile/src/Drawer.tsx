import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { courseLessons, groupCourses, splitName, useAcademy } from './academy';
import { Glass, GlassButton, ProgressBar, Symbol, tick } from './glass';
import { color, font } from './ui';

const Context = createContext<{ open: () => void }>({ open: () => {} });
export const useDrawer = () => useContext(Context);

/** Header button that opens the side drawer, used as headerLeft on the root screens. */
export function DrawerButton() {
  const { open } = useDrawer();
  return <Pressable onPress={() => { tick(); open(); }} accessibilityLabel="Menü öffnen" hitSlop={8} style={s.headerButton}>
    <Symbol name="line.3.horizontal" size={17} tint={color.ink}/>
  </Pressable>;
}

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const panel = Math.min(340, width * .84);

  useEffect(() => {
    if (visible) Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, progress]);

  function close(after?: () => void) {
    Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setVisible(false);
      after?.();
    });
  }

  return <Context.Provider value={{ open: () => setVisible(true) }}>
    {children}
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, s.scrim, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Menü schließen"/>
      </Animated.View>
      <Animated.View style={[s.panel, { width: panel, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-panel - 20, 0] }) }] }]}>
        <DrawerContent close={close}/>
      </Animated.View>
    </Modal>
  </Context.Provider>;
}

function DrawerContent({ close }: { close: (after?: () => void) => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { courses, watched, access } = useAcademy();
  const { user } = useUser();
  const [expanded, setExpanded] = useState<string | null>(courses[0]?.id ?? null);
  const go = (fn: () => void) => { tick(); close(fn); };

  return <Glass style={[s.glass, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]} tint="rgba(13,17,19,.78)">
    <View style={s.brand}>
      <Image source={require('../assets/art/app-icon.png')} alt="" accessible={false} style={s.logo}/>
      <View style={{ flex: 1 }}>
        <Text style={s.brandTitle}>PAT Mentorship</Text>
        <Text style={s.brandSub} numberOfLines={1}>{user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Price Action Trader'}</Text>
      </View>
      <GlassButton compact symbol="xmark" accessibilityLabel="Menü schließen" onPress={() => close()}/>
    </View>

    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
      <NavItem symbol="house" label="Start" onPress={() => go(() => router.navigate('/'))}/>
      <NavItem symbol="graduationcap" label="Mentorship" onPress={() => go(() => router.navigate('/(mentorship)/kurse'))}/>
      <NavItem symbol="person.crop.circle" label="Konto" onPress={() => go(() => router.navigate('/account'))}/>

      {access === 'member' ? <>
        {groupCourses(courses).map(group => <View key={group.key}>
          <Text style={s.section}>{group.number} · {group.title}</Text>
        {group.courses.map(course => {
            const name = splitName(course.name);
            const lessons = courseLessons(course);
            const done = lessons.filter(l => watched.has(l.id)).length;
            const open = expanded === course.id;
            return <View key={course.id}>
              <Pressable onPress={() => { tick(); setExpanded(open ? null : course.id); }} style={({ pressed }) => [s.course, pressed && s.pressed]}>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={s.courseName} numberOfLines={1}>{name.title}</Text>
                  <ProgressBar value={lessons.length ? done / lessons.length : 0} style={{ height: 2 }}/>
                </View>
                <Symbol name={open ? 'chevron.up' : 'chevron.down'} size={11} tint={color.muted}/>
              </Pressable>
              {open ? <View style={s.modules}>
                <Pressable onPress={() => go(() => router.push({ pathname: '/(mentorship)/kurs/[id]', params: { id: course.id } }))} style={({ pressed }) => [s.module, pressed && s.pressed]}>
                  <Text style={[s.moduleName, { color: color.accent }]}>Kursübersicht</Text>
                </Pressable>
                {course.modules.map(m => <Pressable key={m.id} onPress={() => go(() => router.push({ pathname: '/(mentorship)/modul/[id]', params: { id: m.id } }))}
                  style={({ pressed }) => [s.module, pressed && s.pressed]}>
                  <Text style={s.moduleName} numberOfLines={1}>{splitName(m.name).title}</Text>
                </Pressable>)}
              </View> : null}
            </View>;
          })}
        </View>)}
      </> : null}
    </ScrollView>
  </Glass>;
}

function NavItem({ symbol, label, onPress }: { symbol: string; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [s.nav, pressed && s.pressed]} accessibilityRole="link">
    <Symbol name={symbol as never} size={16} tint={color.soft}/>
    <Text style={s.navText}>{label}</Text>
  </Pressable>;
}

const s = StyleSheet.create({
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(4,6,7,.55)' },
  panel: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  glass: { flex: 1, borderRadius: 0, borderTopRightRadius: 28, borderBottomRightRadius: 28, paddingHorizontal: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 18, marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(236,228,216,.18)' },
  logo: { width: 40, height: 40, borderRadius: 10 },
  brandTitle: { fontFamily: font.title, color: color.ink, fontSize: 17 },
  brandSub: { fontFamily: font.body, color: color.muted, fontSize: 12, marginTop: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 6, borderRadius: 12 },
  navText: { fontFamily: font.bold, color: color.ink, fontSize: 14.5 },
  section: { fontFamily: font.mono, color: color.muted, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 18, marginBottom: 6, paddingHorizontal: 6 },
  course: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12 },
  courseNo: { fontFamily: font.mono, color: color.accent, fontSize: 11, width: 18 },
  courseName: { fontFamily: font.bold, color: color.ink, fontSize: 14 },
  modules: { marginLeft: 36, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(236,228,216,.22)', marginBottom: 6 },
  module: { paddingVertical: 8, paddingLeft: 12, borderRadius: 8 },
  moduleName: { fontFamily: font.body, color: color.soft, fontSize: 13.5 },
  pressed: { backgroundColor: 'rgba(255,255,255,.06)' },
});
