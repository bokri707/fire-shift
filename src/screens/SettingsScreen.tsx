import React, { useState } from 'react';
import { Platform, ScrollView, Share, TextInput } from 'react-native';
import { applyBackup, makeBackup, readBackup } from '../lib/backup';
import { useTheme } from '../theme';
import { notifySupported } from '../lib/notify';
import { setNotifyPref, useNotifyPref } from '../DutyNotifier';
import { useStore } from '../store';
import SetupCard from '../SetupCard';
import { Btn, Card, Chip, H2, Hint } from '../ui';

export default function SettingsScreen({ onDone }: { onDone?: () => void }): React.ReactElement {
  const t = useTheme();
  const { state, update, resetAll } = useStore();
  const [armed, setArmed] = useState(false);
  const [code, setCode] = useState('');
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState('');
  const [bad, setBad] = useState(false);
  const np = useNotifyPref();
  const hasSample = state.members.some((m) => m.sample) || Object.keys(state.ex).some((k) => state.ex[k].sample);

  const clearSample = (): void => {
    update((s) => {
      const ex = { ...s.ex };
      Object.keys(ex).forEach((k) => { if (ex[k].sample) delete ex[k]; });
      return { ...s, ex, members: s.members.filter((m) => !m.sample) };
    });
  };

  const say = (m: string, isBad: boolean): void => { setMsg(m); setBad(isBad); };

  const doBackup = async (): Promise<void> => {
    const text = makeBackup(state);
    setCode(text);
    try {
      const g = globalThis as unknown as { navigator?: { clipboard?: { writeText: (v: string) => Promise<void> } } };
      if (Platform.OS === 'web' && g.navigator && g.navigator.clipboard) {
        await g.navigator.clipboard.writeText(text);
        say('복사됐습니다. 카톡 "나에게 보내기"나 메모장에 붙여넣어 보관하세요.', false);
        return;
      }
    } catch (e) { /* 복사가 막히면 아래 글자 상자에서 직접 복사합니다 */ }
    if (Platform.OS !== 'web') {
      try { await Share.share({ message: text }); say('보관할 곳을 골라 보내세요. (카톡 "나에게 보내기" 추천)', false); return; } catch (e) { /* 아래 상자 사용 */ }
    }
    say('아래 글자를 길게 눌러 전체 선택한 뒤 복사해서 보관하세요.', false);
  };

  const doRestore = (): void => {
    const r = readBackup(paste);
    if (!r.ok) { say(r.err, true); return; }
    update((s) => applyBackup(s, r.data));
    setPaste('');
    say('복원했습니다. 달력에서 확인해 보세요.', false);
  };

  const reset = (): void => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false);
    resetAll();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <SetupCard onDone={onDone} />

      {Platform.OS !== 'web' && notifySupported() ? (
        <Card style={{ gap: 10 }}>
          <H2>알림</H2>
          <Hint>근무표나 맞교대를 바꾸면 알림도 저절로 바뀝니다. 근무 알림은 앞으로 14일치입니다. 모임 알림은 앱을 열어 서버에서 확정된 모임을 받은 뒤부터 울립니다.</Hint>
          <Btn ghost={!np.on} label={np.on ? '근무 알림 켜짐 (누르면 끔)' : '근무 알림 켜기 (근무 전날)'} onPress={() => setNotifyPref({ ...np, on: !np.on })} />
          {np.on ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[18, 19, 20, 21, 22].map((h) => <Chip key={h} label={'전날 ' + h + '시'} on={np.hour === h} onPress={() => setNotifyPref({ ...np, hour: h })} />)}
            </ScrollView>
          ) : null}
          <Btn ghost={!np.meet} label={np.meet ? '모임 알림 켜짐 (누르면 끔)' : '모임 알림 켜기 (전날 9시, 당일 8시)'} onPress={() => setNotifyPref({ ...np, meet: !np.meet })} />
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <H2>데이터</H2>
        <Hint>내 근무 설정과 맞교대 기록은 이 폰 안에만 저장됩니다. 소모임의 팀원 근무와 투표는 서버에 있어서 같은 소모임 코드로 들어가면 다시 보입니다. 폰을 바꾸거나 앱을 지우기 전에 아래 백업을 해 두세요.</Hint>
        {hasSample ? <Btn ghost label="예시 데이터 지우기" onPress={clearSample} /> : null}
        <Btn ghost label="내 기록 백업하기 (복사)" onPress={() => { doBackup(); }} />
        {code ? (
          <TextInput
            value={code} editable={false} multiline selectTextOnFocus
            style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink, maxHeight: 110, fontSize: 12 }}
          />
        ) : null}
        <TextInput
          value={paste} onChangeText={(v: string) => { setPaste(v); setMsg(''); }} multiline
          placeholder={'백업 글자를 여기에 붙여넣으세요 (FIRESHIFT1:로 시작)'} placeholderTextColor={t.ink2}
          style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink, maxHeight: 110, fontSize: 12 }}
        />
        <Btn ghost label="백업에서 복원하기" onPress={doRestore} disabled={!paste.trim()} />
        {msg ? <Hint bad={bad}>{msg}</Hint> : null}
        <Btn ghost label={armed ? '한 번 더 눌러 전부 초기화' : '모든 기록 초기화'} onPress={reset} />
      </Card>
    </ScrollView>
  );
}
