import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CourseScreen } from '../../../src/Mentorship';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CourseScreen id={id}/>;
}
