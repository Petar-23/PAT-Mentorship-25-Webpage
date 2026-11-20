import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { LessonScreen } from '../../../src/Mentorship';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LessonScreen id={id}/>;
}
