import React from 'react';
import { Stack } from 'expo-router';
import { homeScreen, stackOptions } from '../../src/header';

export default function HomeLayout() {
  return <Stack screenOptions={stackOptions}>
    <Stack.Screen name="index" options={homeScreen('Start')}/>
  </Stack>;
}
