import React from 'react';
import { Stack } from 'expo-router';
import { filmScreen, homeScreen, rootScreen, stackOptions } from '../../src/header';

export const unstable_settings = { initialRouteName: 'kurse' };

export default function MentorshipLayout() {
  return <Stack screenOptions={stackOptions}>
    <Stack.Screen name="kurse" options={homeScreen('Mentorship')}/>
    <Stack.Screen name="kurs/[id]" options={rootScreen('')}/>
    <Stack.Screen name="modul/[id]" options={rootScreen('')}/>
    <Stack.Screen name="lektion/[id]" options={filmScreen}/>
    <Stack.Screen name="pdf/[id]" options={{ title: '', headerLargeTitle: false, headerTransparent: false, headerStyle: { backgroundColor: '#0D1113' } }}/>
  </Stack>;
}
