import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NativeTabs } from 'expo-router/native-tabs';
import { DarkTheme, ThemeProvider, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { AcademyProvider } from '../src/academy';
import SignInScreen from '../src/SignIn';
import { DrawerProvider } from '../src/Drawer';
import { color } from '../src/ui';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_live_Y2xlcmsucHJpY2UtYWN0aW9uLXRyYWRlci5kZSQ';
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, primary: color.accent, background: color.page, card: color.page, text: color.ink, border: color.line } };

function Splash() {
  return <View style={{ flex: 1, backgroundColor: color.page, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={color.accent}/></View>;
}

function Gate() {
  const { isLoaded, isSignedIn } = useAuth();
  // Lesson and PDF are focus screens: the tab bar steps aside so the video and notes get the whole display.
  const segments = useSegments() as string[];
  const focus = segments.includes('lektion') || segments.includes('pdf');
  if (!isLoaded) return <Splash/>;
  if (!isSignedIn) return <SignInScreen/>;
  return <AcademyProvider>
      <DrawerProvider>
      <NativeTabs tintColor={color.accent} minimizeBehavior="onScrollDown" hidden={focus}>
        <NativeTabs.Trigger name="(home)">
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }}/>
          <NativeTabs.Trigger.Label hidden>Start</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(mentorship)">
          <NativeTabs.Trigger.Icon sf={{ default: 'graduationcap', selected: 'graduationcap.fill' }}/>
          <NativeTabs.Trigger.Label hidden>Mentorship</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="account">
          <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}/>
          <NativeTabs.Trigger.Label hidden>Konto</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      </DrawerProvider>
  </AcademyProvider>;
}

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts({
    PATSerif: require('../assets/fonts/PATSerif-Semibold.ttf'),
    PATSans: require('../assets/fonts/PATSansStudio-Regular.ttf'),
    PATSansSemibold: require('../assets/fonts/PATSansStudio-Semibold.ttf'),
    JetBrainsMono: require('../assets/fonts/JetBrainsMono-Regular.ttf'),
    JetBrainsMonoMedium: require('../assets/fonts/JetBrainsMono-Medium.ttf'),
  });
  return <ThemeProvider value={theme}>
    <StatusBar style="light"/>
    {fontsReady || fontError ? <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}><Gate/></ClerkProvider> : <Splash/>}
  </ThemeProvider>;
}
