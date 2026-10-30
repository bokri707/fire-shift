import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { WD, daysInMonth, firstWd, iso, parse } from './lib/date';
import { MEff, Person, mEff, roster } from './lib/shift';
import { useStore } from './store';
import { kindColors, useTheme } from './theme';
import { Btn, Card, H2, Hint } from './ui';

/** 한 칸에 보여줄 짧은 근무 글자 */
function short(e: MEff): string {
  if (e.kind === 'leave') return '연';
  if (e.kind === 'edu') return '교';
  if (e.kind === 'swap') return e.works ? '맞(근)' : '맞(쉼)';
  return e.l;
}

function Mark({ e, mine }: { e: MEff; mine: boolean }): React.ReactElement {
  const t = useTheme();
  const c = kindColors(t, e.kind);
  const duty = e.kind === 'duty';
  const txt = e.kind === 'swap' ? '맞' : short(e);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 20, borderRadius: 10, backgroundColor: duty ? (mine ? t.duty : t.dutySoft) : 'transparent' }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: duty ? (mine ? t.onDuty : t.duty) : e.works ? c.fg : t.ink2, opacity: duty || e.works ? 1 : 0.55 }}>{txt}</Text>
      {e.care ? <Text style={{ fontSize: 9, fontWeight: '700', color: t.meet }}>육</Text> : null}
    </View>
  );
}

/** 배우자(같은 소모임 동료)와 내 근무를 한 달력에 겹쳐 보고, 둘 다 근무하는 날과 육아시간 쓴 날을 확인합니다. */
export default function CoupleCard(): React.ReactElement | null {
  const t = useTheme();
  const { state, today } = useStore();
  const ms = roster(state);
  const me = ms.find((m) => m.isMe) as Person;
  const others = ms.filter((m) => !m.isMe);
  const [pid, setPid] = useState<string>('');
  const p0 = parse(today);
  const [view, setView] = useState({ y: p0[0], m: p0[1] });

  if (!state.cloud) return null;
  const partner = others.find((m) => m.id === pid) || others[0];

  const move = (d: number): void => {
    let m = view.m + d; let y = view.y;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setView({ y, m });
  };

  const header = (
    <>
      <H2>함께 보기 (부부·가족)</H2>
      {others.length === 0 ? <Hint>같은 소모임에 배우자가 들어오면 두 사람의 근무와 육아시간을 한 달력에서 볼 수 있습니다. 먼저 위의 소모임 코드로 배우자를 초대하세요.</Hint> : null}
    </>
  );
  if (!partner) return <Card style={{ gap: 10 }}>{header}</Card>;

  const first = firstWd(view.y, view.m);
  const n = daysInMonth(view.y, view.m);
  const cells: React.ReactElement[] = [];
  const both: number[] = [];
  for (let i = 0; i < first; i++) cells.push(<View key={'b' + i} style={{ flex: 1 }} />);
  for (let d = 1; d <= n; d++) {
    const s = iso(view.y, view.m, d);
    const a = mEff(me, s);
    const b = mEff(partner, s);
    const bothWork = a.works && b.works;
    if (bothWork) both.push(d);
    const isToday = s === today;
    cells.push(
      <View key={s} style={{ flex: 1, minHeight: 66, gap: 2, paddingVertical: 3, borderRadius: 6, borderWidth: isToday ? 2 : 0, borderColor: t.ink, backgroundColor: bothWork ? t.dutySoft : 'transparent' }}>
        <Text style={{ fontSize: 11, color: t.ink2, textAlign: 'center' }}>{d}</Text>
        <Mark e={a} mine />
        <Mark e={b} mine={false} />
      </View>,
    );
  }
  while (cells.length % 7) cells.push(<View key={'e' + cells.length} style={{ flex: 1 }} />);
  const weeks: React.ReactElement[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <Card style={{ gap: 10 }}>
      {header}
      {others.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {others.map((m) => (
            <Pressable key={m.id} onPress={() => setPid(m.id)} style={{ borderWidth: 1, borderColor: m.id === partner.id ? t.accent : t.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: m.id === partner.id ? t.accent : 'transparent' }}>
              <Text style={{ color: m.id === partner.id ? t.onAccent : t.ink, fontSize: 13 }}>{m.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Btn small ghost label="‹" onPress={() => move(-1)} style={{ minWidth: 40 }} />
        <Text style={{ flex: 1, color: t.ink, fontSize: 18, fontWeight: '600' }}>{view.y}년 {view.m}월 · 나와 {partner.name}</Text>
        <Btn small ghost label="›" onPress={() => move(1)} style={{ minWidth: 40 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {WD.map((w, i) => <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: i === 0 ? t.sun : i === 6 ? t.sat : t.ink2 }}>{w}</Text>)}
      </View>
      {weeks.map((w, wi) => <View key={'w' + wi} style={{ flexDirection: 'row', gap: 3 }}>{w}</View>)}
      <Text style={{ color: t.ink, fontSize: 13 }}>
        둘 다 근무하는 날 <Text style={{ fontWeight: '700', color: t.duty }}>{both.length}일</Text>
      </Text>
      <Hint>칸의 위쪽은 나, 아래쪽은 {partner.name}입니다. 연한 붉은 칸은 두 사람 모두 근무하는 날이고, 글자 옆 육은 육아시간을 쓴 날입니다.</Hint>
    </Card>
  );
}
