import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PdfScreen } from '../../../src/Mentorship';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PdfScreen id={id}/>;
}
