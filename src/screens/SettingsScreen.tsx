import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useStore } from '../store';
import SetupCard from '../SetupCard';
import { Btn, Card, H2, Hint } from '../ui';

export default function SettingsScreen({ onDone }: { onDone?: () => void }): React.ReactElement {
  const { state, update, resetAll } = useStore();
  const [armed, setArmed] = useState(false);
  const hasSample = state.members.some((m) => m.sample) || Object.keys(state.ex).some((k) => state.ex[k].sample);

  const clearSample = (): void => {
    update((s) => {
      const ex = { ...s.ex };
      Object.keys(ex).forEach((k) => { if (ex[k].sample) delete ex[k]; });
      return { ...s, ex, members: s.members.filter((m) => !m.sample) };
    });
  };

  const reset = (): void => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false);
    resetAll();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <SetupCard onDone={onDone} />

      <Card style={{ gap: 10 }}>
        <H2>데이터</H2>
        <Hint>모든 기록은 이 폰 안에만 저장됩니다. 팀 기능은 서버 없이 이 폰에서만 동작하는 테스트판이라, 팀원 근무와 투표 결과는 다른 사람의 폰과 공유되지 않습니다.</Hint>
        {hasSample ? <Btn ghost label="예시 데이터 지우기" onPress={clearSample} /> : null}
        <Btn ghost label={armed ? '한 번 더 눌러 전부 초기화' : '모든 기록 초기화'} onPress={reset} />
      </Card>
    </ScrollView>
  );
}
