import React, { useState } from 'react';
import { Keyboard, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { WD, fromIdx, idx } from './lib/date';
import { OFF_LABELS, PRESETS, WORK_LABELS, baseDay, isThree } from './lib/shift';
import { useStore } from './store';
import { useTheme } from './theme';
import { AppState, Pattern } from './types';
import { Btn, Card, Chip, H2, Hint, SegRow } from './ui';

const CUSTOM = '내 주기 만들기';

/** 3교대일 때 동료 계산 기준일을 내 팀·기준일에 맞춰 갱신합니다. */
function withBase3(s: AppState): AppState {
  return isThree(s.pattern) ? { ...s, base3: fromIdx(idx(s.anchor) - (s.team - 1)) } : s;
}

export default function SetupCard({ onDone }: { onDone?: () => void }): React.ReactElement {
  const t = useTheme();
  const { state, update, today } = useStore();
  const pat = state.pattern;
  const three = isThree(pat);
  const [more, setMore] = useState(false);
  /** 처음 설정은 소방 3교대 기준으로 팀과 오늘 상태만 묻습니다. */
  const simple = !state.configured && three && !more;
  const todayPos = baseDay(pat, state.anchor, state.manual, today).pos;

  const dropSamples = (s: AppState): AppState => {
    const ex = { ...s.ex };
    Object.keys(ex).forEach((k) => { if (ex[k].sample) delete ex[k]; });
    return { ...s, ex };
  };

  const choose = (p: Pattern): void => {
    update((s) => {
      let n: AppState = { ...dropSamples(s), pattern: { ...p, d: p.d.map((x) => ({ ...x })) } };
      if (p.t === 'cycle') n = { ...n, anchor: today };
      return withBase3(n);
    });
  };

  const setPos = (i: number): void => {
    update((s) => withBase3({ ...dropSamples(s), anchor: fromIdx(idx(today) - i) }));
  };

  const editPattern = (fn: (p: Pattern) => Pattern): void => {
    update((s) => ({ ...s, pattern: fn(s.pattern) }));
  };

  const finish = (): void => {
    Keyboard.dismiss();
    update((s) => ({ ...s, configured: true }));
    if (onDone) onDone();
  };

  const posLabel = (i: number): string => {
    if (three) return ['당직', '비번 1일차', '비번 2일차'][i];
    return (i + 1) + '일째 ' + pat.d[i].l;
  };

  return (
    <Card style={{ gap: 12 }}>
      <H2>내 근무 설정</H2>
      {!state.configured ? (
        <Hint>{simple ? '내 팀과 오늘 상태만 고르면 달력이 자동으로 채워집니다.' : '내 근무 형태를 고르고 오늘 상태만 고르면 달력이 자동으로 채워집니다. 근무가 매달 다르면 "매달 직접 입력"을 고르세요.'}</Hint>
      ) : null}

      {!simple ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.ink2, fontSize: 12 }}>근무 형태</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map((p) => <Chip key={p.n} label={p.n} on={pat.n === p.n} onPress={() => choose(p)} />)}
          </View>
        </View>
      ) : null}

      {three ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.ink2, fontSize: 12 }}>내 팀</Text>
          <SegRow<number>
            options={[{ v: 1, label: '1팀' }, { v: 2, label: '2팀' }, { v: 3, label: '3팀' }]}
            value={state.team}
            onChange={(v) => update((s) => withBase3({ ...s, team: v }))}
          />
        </View>
      ) : null}

      {pat.n === CUSTOM ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.ink2, fontSize: 12 }}>한 바퀴 순서 (칸을 누르면 지워집니다)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {pat.d.map((x, i) => (
              <Chip key={i} label={(i + 1) + '.' + x.l} on={x.w} onPress={() => editPattern((p) => ({ ...p, d: p.d.filter((_, j) => j !== i) }))} />
            ))}
          </View>
          <Text style={{ color: t.ink2, fontSize: 12 }}>추가하기</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {WORK_LABELS.concat(OFF_LABELS).map((l) => (
              <Btn key={l} small ghost label={'+ ' + l + (OFF_LABELS.indexOf(l) >= 0 ? ' (쉼)' : ' (근무)')}
                onPress={() => editPattern((p) => (p.d.length >= 14 ? p : { ...p, d: [...p.d, { l, w: OFF_LABELS.indexOf(l) < 0 }] }))} />
            ))}
          </View>
          <Hint>순서대로 눌러서 한 바퀴를 만드세요. 예: 주, 야, 비, 휴. 최대 14칸까지 가능합니다.</Hint>
        </View>
      ) : null}

      {pat.t === 'week' ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: t.ink2, fontSize: 12 }}>근무하는 요일 (누르면 바뀝니다)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {pat.d.map((x, i) => (
              <Chip key={i} label={WD[i] + (x.w ? ' 근무' : ' 휴')} on={x.w}
                onPress={() => editPattern((p) => ({ ...p, d: p.d.map((y, j) => (j === i ? { l: y.w ? '휴' : '근', w: !y.w } : y)) }))} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: t.ink, fontSize: 14 }}>공휴일은 쉼</Text>
            <Switch value={!!pat.h} onValueChange={(v: boolean) => editPattern((p) => ({ ...p, h: v }))} />
          </View>
        </View>
      ) : null}

      {pat.t === 'cycle' && pat.d.length ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.ink2, fontSize: 12 }}>오늘 나는</Text>
          {three ? (
            <SegRow<number>
              options={[{ v: 0, label: '당직' }, { v: 1, label: '비번 1일차' }, { v: 2, label: '비번 2일차' }]}
              value={todayPos}
              onChange={setPos}
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {pat.d.map((_, i) => <Chip key={i} label={posLabel(i)} on={todayPos === i} onPress={() => setPos(i)} />)}
            </View>
          )}
        </View>
      ) : null}

      {pat.t === 'manual' ? (
        <Hint>달력에서 날짜를 눌러 그날의 근무(주·야·당·비·휴 등)를 지정하세요. 지정하지 않은 날은 쉬는 날로 봅니다.</Hint>
      ) : null}

      {simple ? (
        <Pressable onPress={() => setMore(true)} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
          <Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>다른 근무 형태예요 (4조 2교대·일근·직접 입력 등) ›</Text>
        </Pressable>
      ) : (
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.ink2, fontSize: 12 }}>기본 별명 (새 소모임의 기본값 · 소모임마다 따로 바꿀 수 있음)</Text>
          <TextInput
            value={state.nick} maxLength={12} placeholder="나" placeholderTextColor={t.ink2}
            returnKeyType="done" blurOnSubmit onSubmitEditing={finish}
            onChangeText={(v: string) => update((s) => ({ ...s, nick: v }))}
            style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink }}
          />
        </View>
      )}
      <Btn label="완료" onPress={finish} />
    </Card>
  );
}
