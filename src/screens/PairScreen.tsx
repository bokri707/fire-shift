import React from 'react';
import { ScrollView } from 'react-native';
import { PairCard } from '../CoupleCard';

export default function PairScreen(): React.ReactElement {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
      <PairCard />
    </ScrollView>
  );
}
