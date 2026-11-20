import React, { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Button as SUIButton, Host, Label as SUILabel } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, disabled as suiDisabled, font as suiFont, frame, labelStyle, tint as suiTint } from '@expo/ui/swift-ui/modifiers';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { color, font, Icon, type IconName } from './ui';

const liquid = Platform.OS === 'ios' && isLiquidGlassAvailable();

export function tick() { if (Platform.OS === 'ios') void Haptics.selectionAsync().catch(() => {}); }

/** System Liquid Glass on iOS 26+, a frosted fallback everywhere else. */
export function Glass({ children, style, tint, interactive = false, clear = false }: {
  children?: ReactNode; style?: StyleProp<ViewStyle>; tint?: string; interactive?: boolean; clear?: boolean;
}) {
  if (liquid) {
    return <GlassView glassEffectStyle={clear ? 'clear' : 'regular'} tintColor={tint} isInteractive={interactive}
      colorScheme="dark" style={[styles.glassBase, style]}>{children}</GlassView>;
  }
  return <View style={[styles.glassBase, styles.fallback, tint ? { backgroundColor: tint } : null, style]}>{children}</View>;
}

const fallbackIcon: Partial<Record<SFSymbol, IconName>> = {
  'play.fill': 'play', 'arrow.down': 'download', 'arrow.down.circle': 'download', 'checkmark': 'check',
  'trash': 'trash', 'arrow.up.right': 'external', 'clock': 'clock', 'chevron.right': 'right',
};

export function Symbol({ name, size = 20, tint = color.ink }: { name: SFSymbol; size?: number; tint?: string }) {
  const fallback = fallbackIcon[name];
  return <SymbolView name={name} size={size} tintColor={tint} weight="semibold" resizeMode="scaleAspectFit"
    fallback={fallback ? <Icon name={fallback} size={size} tint={tint}/> : null} style={{ width: size, height: size }}/>;
}

/** Small capsule label, glass when it floats over imagery. */
export function Chip({ label, symbol, accent = false, onImage = false }: { label: string; symbol?: SFSymbol; accent?: boolean; onImage?: boolean }) {
  const ink = accent ? color.accent : color.soft;
  const content = <>{symbol ? <Symbol name={symbol} size={11} tint={ink}/> : null}<Text style={[styles.chipText, { color: ink }]}>{label}</Text></>;
  if (onImage) return <Glass clear tint="rgba(8,10,11,.42)" style={styles.chip}>{content}</Glass>;
  return <View style={[styles.chip, styles.chipFlat, accent && { backgroundColor: 'rgba(231,131,112,.13)' }]}>{content}</View>;
}

/** Capsule button with system glass. `prominent` tints it in the PAT salmon. */
export function GlassButton(props: GlassButtonProps) {
  // iOS: Apple's own SwiftUI button with the system glass styles, so every action looks and feels native.
  if (Platform.OS === 'ios') return <SystemButton {...props}/>;
  return <FallbackButton {...props}/>;
}

type GlassButtonProps = {
  label?: string; symbol: SFSymbol; onPress: () => void; prominent?: boolean; busy?: boolean; disabled?: boolean; compact?: boolean;
  accessibilityLabel?: string; plain?: boolean; destructive?: boolean;
};

function SystemButton({ label, symbol, onPress, prominent = false, busy = false, disabled = false, compact = false, accessibilityLabel, plain = false, destructive = false }: GlassButtonProps) {
  const round = !label;
  const mods = [
    buttonStyle(plain ? 'borderless' : prominent ? 'glassProminent' : 'glass'),
    controlSize(compact || plain ? 'regular' : 'large'),
    buttonBorderShape(round ? 'circle' : 'capsule'),
    labelStyle(round ? 'iconOnly' : plain ? 'titleOnly' : 'titleAndIcon'),
    suiDisabled(busy || disabled),
  ];
  if (prominent || plain) mods.push(suiTint(color.accent));
  const wide = !round && !plain;
  // The frame goes on the label, not the button: that is what makes the glass capsule itself fill the row.
  const labelMods = [suiFont({ family: 'PATSansStudio-Semibold', size: compact || plain ? 15 : 16 })];
  if (wide) labelMods.push(frame({ maxWidth: 100000 }));
  return <Host matchContents={wide ? { vertical: true } : true} style={wide ? { flexGrow: 1, flexShrink: 1, alignSelf: 'stretch' } : undefined}>
    <SUIButton role={destructive ? 'destructive' : 'default'} onPress={() => { tick(); onPress(); }} modifiers={mods}>
      <SUILabel title={busy ? 'Einen Moment …' : label ?? accessibilityLabel ?? ''} systemImage={busy ? 'hourglass' : symbol} modifiers={labelMods}/>
    </SUIButton>
  </Host>;
}

function FallbackButton({ label, symbol, onPress, prominent = false, busy = false, disabled = false, compact = false, accessibilityLabel }: GlassButtonProps) {
  const ink = prominent ? '#1A0E0B' : color.ink;
  const round = !label;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: busy || disabled, busy }}
    disabled={busy || disabled} onPress={() => { tick(); onPress(); }}
    style={({ pressed }) => [{ opacity: disabled ? .5 : 1, transform: [{ scale: pressed && !liquid ? .97 : 1 }] }, !round && { flexGrow: 1 }]}>
    <Glass interactive tint={prominent ? color.accent : undefined}
      style={[styles.button, compact && styles.buttonCompact, round && { width: compact ? 40 : 46, paddingHorizontal: 0 }]}>
      {busy ? <ActivityIndicator size="small" color={ink}/> : <Symbol name={symbol} size={compact ? 15 : 17} tint={ink}/>}
      {label ? <Text numberOfLines={1} style={[styles.buttonText, { color: ink }]}>{label}</Text> : null}
    </Glass>
  </Pressable>;
}

/** Soft colour field behind the top of a screen, so the glass header has something to refract. */
export function Ambient({ glow = 'rgba(231,131,112,.22)', height = 460 }: { glow?: string; height?: number }) {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height, bottom: undefined }]}>
    <LinearGradient colors={[glow, 'rgba(13,17,19,0)']} start={{ x: 1, y: 0 }} end={{ x: .25, y: 1 }} style={StyleSheet.absoluteFill}/>
    <LinearGradient colors={['rgba(13,17,19,0)', color.page]} locations={[.45, 1]} style={StyleSheet.absoluteFill}/>
  </View>;
}

export function ProgressBar({ value, style }: { value: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.track, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
    {value > 0 ? <View style={[styles.bar, { width: `${Math.max(4, Math.min(100, value * 100))}%` }]}/> : null}
  </View>;
}

export function SectionTitle({ children, detail }: { children: string; detail?: string }) {
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.sectionText}>{children}</Text>
    {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
  </View>;
}

export const radius = { card: 26, media: 18 };

/** Content that eases in: fade plus a short rise, staggered by `delay`. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 460, delay, easing: Easing.bezier(.2, .8, .2, 1), useNativeDriver: true }).start();
  }, [v, delay]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{children}</Animated.View>;
}

/** Pressable card with a soft spring press-down, like system cards. */
export function Pressy({ children, style, containerStyle, onPress, ...props }: Omit<PressableProps, 'style' | 'children'> & { children: ReactNode; style?: StyleProp<ViewStyle>; containerStyle?: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) => Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: value === 1 ? 6 : 0 }).start();
  return <Pressable {...props} style={containerStyle} onPress={onPress} onPressIn={() => to(.975)} onPressOut={() => to(1)}>
    <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
  </Pressable>;
}

const styles = StyleSheet.create({
  glassBase: { borderRadius: 999, overflow: 'hidden', borderCurve: 'continuous' },
  fallback: { backgroundColor: 'rgba(40,46,49,.72)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.16)' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', borderRadius: 999 },
  chipFlat: { backgroundColor: 'rgba(255,255,255,.07)' },
  chipText: { fontFamily: font.mono, fontSize: 10.5, lineHeight: 14, letterSpacing: .5, textTransform: 'uppercase', fontVariant: ['tabular-nums'] },
  button: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  buttonCompact: { minHeight: 44, paddingHorizontal: 16 },
  buttonText: { fontFamily: font.bold, fontSize: 14.5, lineHeight: 19, letterSpacing: -.1 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.14)', overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2, backgroundColor: color.accent },
  section: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 26, marginBottom: 10 },
  sectionText: { fontFamily: font.title, color: color.ink, fontSize: 19, lineHeight: 24, letterSpacing: -.3 },
  sectionDetail: { fontFamily: font.mono, color: color.muted, fontSize: 10.5, letterSpacing: .6, textTransform: 'uppercase' },
});
