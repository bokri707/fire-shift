import React, { useState } from 'react';
import { Platform, ScrollView, Share, Switch, Text, TextInput, View } from 'react-native';
import { applyBackup, makeBackup, readBackup } from '../lib/backup';
import { useTheme } from '../theme';
import { notifySupported } from '../lib/notify';
import { setNotifyPref, useNotifyPref } from '../DutyNotifier';
import { groupKind, useStore } from '../store';
import SetupCard from '../SetupCard';
import { Btn, Card, Chip, H2, Hint } from '../ui';

const hlabel = (h: number): string => (h < 12 ? '오전 ' + (h === 0 ? 12 : h) : '오후 ' + (h === 12 ? 12 : h - 12)) + '시';

export default function SettingsScreen({ onDone }: { onDone?: () => void }): React.ReactElement {
  const t = useTheme();
  const { state, update, resetAll } = useStore();
  const [armed, setArmed] = useState(false);
  const [code, setCode] = useState('');
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState('');
  const [bad, setBad] = useState(false);
  const np = useNotifyPref();
  const groups = (state.cloud ? [state.cloud] : []).concat(state.others || []);
  const hasTeam = groups.some((g) => groupKind(g) === 'team');
  const hasMeet = groups.some((g) => groupKind(g) === 'meet');
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

      <Card style={{ gap: 12 }}>
        <H2>기능 켜기</H2>
        <Hint>쓰지 않는 기능은 숨겨 두었습니다. 필요한 것만 켜세요. 언제든 끌 수 있고, 꺼도 기록은 지워지지 않습니다.</Hint>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600' }}>팀</Text>
            <Text style={{ color: t.ink2, fontSize: 12 }}>{hasTeam ? '근무 팀에 들어가 있어서 켜져 있습니다.' : '같은 팀 동료와 근무 공유, 연가계획, 팀 일정'}</Text>
          </View>
          <Switch value={state.teamOn === true || hasTeam} disabled={hasTeam} onValueChange={(v: boolean) => update((s) => ({ ...s, teamOn: v }))} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600' }}>모임</Text>
            <Text style={{ color: t.ink2, fontSize: 12 }}>{hasMeet ? '모임에 들어가 있어서 켜져 있습니다.' : '러닝크루·가족·동기모임 일정과 투표'}</Text>
          </View>
          <Switch value={state.meetOn === true || hasMeet} disabled={hasMeet} onValueChange={(v: boolean) => update((s) => ({ ...s, meetOn: v }))} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600' }}>부부·육아</Text>
            <Text style={{ color: t.ink2, fontSize: 12 }}>배우자와 근무를 함께 보고 육아시간 확인</Text>
          </View>
          <Switch value={state.pairOn === true} onValueChange={(v: boolean) => update((s) => ({ ...s, pairOn: v }))} />
        </View>
      </Card>

      {Platform.OS !== 'web' && notifySupported() ? (
        <Card style={{ gap: 10 }}>
          <H2>알림</H2>
          <Hint>근무표나 맞교대를 바꾸면 알림도 저절로 바뀝니다. 근무 알림은 앞으로 14일치입니다. 모임 알림은 앱을 열어 서버에서 확정된 모임을 받은 뒤부터 울립니다.</Hint>
          <Btn ghost={!np.on} label={np.on ? '근무 알림 켜짐 (누르면 끔)' : '근무 알림 켜기 (근무 전날)'} onPress={() => setNotifyPref({ ...np, on: !np.on })} />
          {np.on ? <Hint>근무 전날 {np.hour < 12 ? '오전 ' + (np.hour === 0 ? 12 : np.hour) : '오후 ' + (np.hour === 12 ? 12 : np.hour - 12)}시에 알려 드립니다. 아래에서 언제든 바꿀 수 있고, 바꾸면 알림이 바로 다시 예약됩니다.</Hint> : null}
          {np.on ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {Array.from({ length: 24 }, (_, h) => h).map((h) => <Chip key={h} label={'전날 ' + (h < 12 ? '오전 ' + (h === 0 ? 12 : h) : '오후 ' + (h === 12 ? 12 : h - 12)) + '시'} on={np.hour === h} onPress={() => setNotifyPref({ ...np, hour: h })} />)}
            </ScrollView>
          ) : null}
          <Btn ghost={!np.meet} label={np.meet ? '모임 알림 켜짐 (누르면 끔)' : '모임 알림 켜기'} onPress={() => setNotifyPref({ ...np, meet: !np.meet })} />
          {np.meet ? (
            <View style={{ gap: 8 }}>
              <Hint>모임 전날 {hlabel(np.meetEve)}, 모임 당일 {hlabel(np.meetDay)}에 알려 드립니다. 언제든 바꿀 수 있고, 바꾸면 알림이 바로 다시 예약됩니다.</Hint>
              <Text style={{ color: t.ink2, fontSize: 12 }}>모임 전날 알림 시각</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {Array.from({ length: 24 }, (_, h) => h).map((h) => <Chip key={h} label={hlabel(h)} on={np.meetEve === h} onPress={() => setNotifyPref({ ...np, meetEve: h })} />)}
              </ScrollView>
              <Text style={{ color: t.ink2, fontSize: 12 }}>모임 당일 알림 시각</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {Array.from({ length: 24 }, (_, h) => h).map((h) => <Chip key={h} label={hlabel(h)} on={np.meetDay === h} onPress={() => setNotifyPref({ ...np, meetDay: h })} />)}
              </ScrollView>
            </View>
          ) : null}
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
