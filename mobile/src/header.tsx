import React from 'react';
import { Platform } from 'react-native';
import { DrawerButton } from './Drawer';
import { color, font } from './ui';

/** Shared native-stack look: iOS large titles in PAT Serif, transparent glass header. */
export const stackOptions = {
  headerTransparent: Platform.OS === 'ios',
  headerShadowVisible: false,
  headerLargeTitleShadowVisible: false,
  headerTintColor: color.accent,
  headerBackButtonDisplayMode: 'minimal' as const,
  headerLargeTitleStyle: { fontFamily: font.title, color: color.ink, fontSize: 30 },
  headerTitleStyle: { fontFamily: font.bold, color: color.ink, fontSize: 16 },
  contentStyle: { backgroundColor: color.page },
  headerStyle: Platform.OS === 'ios' ? undefined : { backgroundColor: color.page },
};

export const rootScreen = (title: string) => ({ title, headerLargeTitle: true });
export const homeScreen = (title: string) => ({ title, headerLargeTitle: true, headerLeft: () => <DrawerButton/> });
export const filmScreen = { title: '', headerLargeTitle: false };
