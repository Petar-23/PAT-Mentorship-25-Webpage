import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ModuleScreen } from '../../../src/Mentorship';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ModuleScreen id={id}/>;
}
