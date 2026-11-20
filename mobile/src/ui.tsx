import React, { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export const color = {
  page: '#0D1113', surface: '#171D20', line: '#30383A', ink: '#FBF1E7',
  muted: '#ADB2B1', soft: '#D7D3CC', accent: '#E78370', salmon: '#DE7461', stage: '#080B0C',
};
export const font = { title: 'PATSerif', body: 'PATSans', bold: 'PATSansSemibold', mono: 'JetBrainsMono', monoMedium: 'JetBrainsMonoMedium' };
export type IconName = 'shelf' | 'download' | 'account' | 'back' | 'right' | 'play' | 'check' | 'external' | 'trash' | 'clock';

export function Icon({ name, size = 22, tint = color.ink }: { name: IconName; size?: number; tint?: string }) {
  const geometry: Record<IconName, ReactNode> = {
    shelf: <><Rect x="3.2" y="4" width="4.1" height="15.8" rx=".8"/><Rect x="9.8" y="4" width="4.1" height="15.8" rx=".8"/><Path d="m16.4 5.5 3.3-.7 3 14-3.3.8z"/></>,
    download: <><Path d="M12 3.5v10.3m-4.2-4.2 4.2 4.2 4.2-4.2M4.7 15.3v3.2c0 1 .7 1.7 1.7 1.7h11.2c1 0 1.7-.7 1.7-1.7v-3.2"/></>,
    account: <><Circle cx="12" cy="8.2" r="3.4"/><Path d="M4.8 20c.7-3.2 3.4-5.1 7.2-5.1s6.5 1.9 7.2 5.1"/></>,
    back: <Path d="M19 12H5m6.4-6.4L5 12l6.4 6.4"/>,
    right: <Path d="M4 12h15m-6.2-6.2L19 12l-6.2 6.2"/>,
    play: <Path d="M8.1 4.9 19 12 8.1 19.1Z" fill={tint} strokeWidth="1.3"/>,
    check: <Path d="m4.8 12.2 4.6 4.5 9.9-10.1"/>,
    external: <Path d="M7 17 17 7M7.5 7H17v9.5"/>,
    trash: <><Path d="M4.5 7h15m-12.7 0 1 12.1h8.5l1-12.1M9.2 7V4.4h5.6V7"/></>,
    clock: <><Circle cx="12" cy="12" r="8.5"/><Path d="M12 7.3v5.1l3.4 2.1"/></>,
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={tint}
    strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round" accessible={false} aria-hidden>{geometry[name]}</Svg>;
}

export function Tap({ children, style, ...props }: Omit<PressableProps, 'children' | 'style'> & {children: ReactNode; style?: StyleProp<ViewStyle>}) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" {...props} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [style, pressed && { opacity: .73 }, Platform.OS !== 'web' && focused && { outlineColor: color.accent, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 }]}>
    {children}
  </Pressable>;
}

export function Label({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return <Text style={[styles.label, accent && { color: color.accent }]}>{children}</Text>;
}

export function Wordmark() {
  return <View accessible accessibilityLabel="Price Action Trader" style={styles.wordmark}>
    <Text allowFontScaling={false} style={styles.monogram}>PAT</Text>
    <View style={styles.divider}/><Text allowFontScaling={false} style={styles.brandName}>{'PRICE ACTION\nTRADER'}</Text>
  </View>;
}

export function Action({ label, icon, onPress, primary = false, busy = false, disabled = false }: {
  label: string; icon: IconName; onPress: () => void; primary?: boolean; busy?: boolean; disabled?: boolean;
}) {
  return <Tap accessibilityLabel={label} accessibilityState={{ disabled: busy || disabled, busy }} onPress={onPress}
    disabled={busy || disabled} style={[styles.action, primary && styles.primary, disabled && { opacity: .6 }]}>
    {busy ? <ActivityIndicator size="small" color={primary ? color.page : color.accent}/> :
      <Icon name={icon} size={18} tint={primary ? color.page : color.soft}/>}
    <Text style={[styles.actionText, primary && { color: color.page }]}>{label}</Text>
  </Tap>;
}

export const styles = StyleSheet.create({
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  monogram: { fontFamily: font.title, fontSize: 32, lineHeight: 40, letterSpacing: -1.9, color: color.ink, includeFontPadding: false },
  divider: { width: 1, height: 23, backgroundColor: '#596060' },
  brandName: { fontFamily: font.bold, fontSize: 9.5, letterSpacing: 1.5, color: color.soft, lineHeight: 12.5 },
  label: { color: color.muted, fontFamily: font.bold, fontSize: 10.5, lineHeight: 16, letterSpacing: 1.45, textTransform: 'uppercase' },
  title: { fontFamily: font.title, color: color.ink, fontSize: 48, lineHeight: 61, letterSpacing: -2.1 },
  subtitle: { fontFamily: font.title, color: color.ink, fontSize: 28, lineHeight: 37, letterSpacing: -.9 },
  body: { color: color.soft, fontFamily: font.body, fontSize: 16, lineHeight: 24 },
  small: { color: color.muted, fontFamily: font.body, fontSize: 13, lineHeight: 19 },
  action: { minHeight: 49, borderWidth: 1, borderColor: color.line, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  primary: { backgroundColor: color.accent, borderColor: color.accent },
  actionText: { fontFamily: font.bold, fontSize: 15, lineHeight: 22, color: color.ink, flexShrink: 1, textAlign: 'center' },
});
