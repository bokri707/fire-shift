import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Platform, Pressable, Text, View, ViewStyle } from 'react-native';
import { WD, daysInMonth, firstWd, iso, parse } from './lib/date';
import { holName } from './lib/holidays';
import { GROUP_COLORS, eventsByDate } from './lib/events';
import { Poll } from './types';
import { LBL, allMeets, eff, hasManyGroups } from './lib/shift';
import { useStore } from './store';
import { kindColors, useTheme } from './theme';
import { Btn, Card } from './ui';

const GAP = 4;


export interface Deco {
  /** 선택된 날: 칸 전체를 이 색으로 채우고 글자를 흰색으로 */
  solid?: string;
  bg?: string;
  border?: string;
  tag?: string;
  tagColor?: string;
}

interface Props {
  onPressDate: (s: string) => void;
  decorate?: (s: string) => Deco | null;
  /** 이 날짜가 바뀌면 달력이 그 달로 이동합니다. */
  focusDate?: string;
  bare?: boolean;
}

export default function MonthCalendar({ onPressDate, decorate, focusDate, bare }: Props): React.ReactElement {
  const t = useTheme();
  const { state, today } = useStore();
  const [view, setView] = useState(() => { const p = parse(today); return { y: p[0], m: p[1] }; });
  const [gridW, setGridW] = useState(0);

  useEffect(() => {
    if (focusDate) { const p = parse(focusDate); setView({ y: p[0], m: p[1] }); }
  }, [focusDate]);

  const cellW = gridW > 0 ? Math.floor((gridW - GAP * 6) / 7) : 0;
  const move = (d: number): void => {
    setView((v) => {
      let m = v.m + d;
      let y = v.y;
      if (m < 1) { m = 12; y--; }
      if (m > 12) { m = 1; y++; }
      return { y, m };
    });
  };

  // 좌우로 밀면 달이 바뀝니다. (왼쪽으로 밀면 다음 달) 세로 스크롤과 날짜 누르기는 그대로 둡니다.
  const moveRef = useRef(move);
  moveRef.current = move;
  const swipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_e, g) => {
      if (g.dx <= -50) moveRef.current(1);
      else if (g.dx >= 50) moveRef.current(-1);
    },
  }), []);
  const webTouch = (Platform.OS === 'web' ? { touchAction: 'pan-y' } : {}) as unknown as ViewStyle;

  const first = firstWd(view.y, view.m);
  const n = daysInMonth(view.y, view.m);
  const cells: React.ReactElement[] = [];
  const hols: { d: number; name: string }[] = [];
  const meets: Record<string, { t: string; g: string }[]> = {};
  const many = hasManyGroups(state);
  allMeets(state).forEach((p) => { if (!meets[p.final]) meets[p.final] = []; meets[p.final].push({ t: p.title, g: many ? p.group : '' }); });
  // 팀 일정(모임과 별개)은 칸 왼쪽 아래에 작은 색 점으로 표시합니다.
  const grp: { code: string; name: string; polls: Poll[] }[] = [];
  if (state.cloud) grp.push({ code: state.cloud.code, name: state.cloud.name, polls: state.polls });
  (state.others || []).forEach((g) => grp.push({ code: g.code, name: g.name, polls: g.polls }));
  const codes = grp.map((g) => g.code).sort();
  const evs: Record<string, { name: string; color: string; group: string; kind: string }[]> = {};
  grp.forEach((g) => {
    const gc = GROUP_COLORS[codes.indexOf(g.code) % GROUP_COLORS.length];
    const by = eventsByDate(g.polls);
    Object.keys(by).forEach((d) => by[d].forEach((x) => {
      (evs[d] = evs[d] || []).push({ name: x.name, color: many ? gc : x.color, group: many ? g.name : '', kind: x.kind });
    }));
  });
  const evNames: { d: number; name: string; color: string; group: string }[] = [];
  const meetList: { d: number; name: string }[] = [];
  for (let i = 0; i < first; i++) cells.push(<View key={'b' + i} style={{ width: cellW, height: 4 }} />);
  for (let d = 1; d <= n; d++) {
    const s = iso(view.y, view.m, d);
    const e = eff(state, s);
    const wk = (first + d - 1) % 7;
    const hn = holName(s);
    if (hn) hols.push({ d, name: hn });
    const isToday = s === today;
    const c = kindColors(t, e.kind);
    const deco = decorate ? decorate(s) : null;
    const mt = meets[s];
    const ev = evs[s];
    if (ev) ev.filter((x) => x.kind !== 'meet').forEach((x) => evNames.push({ d, name: x.name, color: x.color, group: x.group }));
    if (mt) mt.forEach((m) => meetList.push({ d, name: m.g ? m.g + ' · ' + m.t : m.t }));
    const chipText = e.label === '당직' ? '당' : e.label === '비번' ? '비' : e.label;
    const care = e.sub.startsWith('육아');
    const careL = care && (e.sub.includes('출근 때') || e.sub.includes('모두'));
    const careR = care && !e.sub.includes('출근 때');
    const sol = deco && deco.solid ? deco.solid : '';
    const numColor = isToday ? t.surface : sol ? '#FFFFFF' : hn || wk === 0 ? t.sun : wk === 6 ? t.sat : t.ink;
    const borderColor = isToday ? t.ink : sol ? sol : deco && deco.border ? deco.border : mt ? t.meet : hn ? t.hol : t.line;
    const borderWidth = isToday ? 2.5 : deco && deco.border ? 3 : mt ? 3 : hn ? 2 : 1;
    cells.push(
      <Pressable
        key={s}
        accessibilityRole="button"
        accessibilityLabel={(isToday ? '오늘 ' : '') + view.m + '월 ' + d + '일 ' + (hn ? '공휴일 ' + hn + ' ' : '') + e.label + (e.sub ? ' ' + e.sub : '') + (deco && deco.tag ? ' ' + deco.tag : '')}
        onPress={() => onPressDate(s)}
        style={{
          width: cellW, minHeight: hn ? 80 : 62, marginBottom: 7, alignItems: 'center', justifyContent: 'space-between',
          paddingVertical: 5, borderRadius: 6, borderWidth, borderColor,
          backgroundColor: sol || (deco && deco.bg ? deco.bg : 'transparent'),
        }}
      >
        <View style={{ alignSelf: 'flex-start', marginLeft: 1, minWidth: 20, paddingHorizontal: 4, borderRadius: 5, backgroundColor: isToday ? t.ink : 'transparent' }}>
          <Text style={{ color: numColor, fontSize: 12, fontWeight: '700', lineHeight: 18, textAlign: 'center' }}>{d}</Text>
        </View>
        {hn ? <Text style={{ color: sol ? '#FFFFFF' : t.sun, fontSize: 9, fontWeight: '700', lineHeight: 11, textAlign: 'center' }}>{hn}</Text> : null}
        <View style={{
          minWidth: 24, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, alignItems: 'center',
          backgroundColor: e.kind === 'duty' ? t.duty : e.kind === 'off' ? 'transparent' : c.bg,
        }}>
          <Text style={{
            fontSize: 12, fontWeight: e.kind === 'off' ? '500' : '700',
            color: e.kind === 'duty' ? t.onDuty : sol ? '#FFFFFF' : e.kind === 'off' ? t.ink2 : c.fg,
          }}>{chipText}</Text>
          {careL ? <View style={{ position: 'absolute', top: '50%', marginTop: -2.5, left: -6, width: 5, height: 5, borderRadius: 3, backgroundColor: '#E67E22' }} /> : null}
          {careR ? <View style={{ position: 'absolute', top: '50%', marginTop: -2.5, right: -6, width: 5, height: 5, borderRadius: 3, backgroundColor: '#E67E22' }} /> : null}
        </View>
        {mt && !(deco && deco.tag) ? (
          <View style={{ maxWidth: '100%', paddingHorizontal: 4, borderRadius: 4, backgroundColor: t.meet }}>
            <Text numberOfLines={1} style={{ color: t.onMeet, fontSize: 10.5, fontWeight: '700' }}>{mt.length > 1 ? mt[0].t.slice(0, 2) + '+' + (mt.length - 1) : mt[0].t.slice(0, 4)}</Text>
          </View>
        ) : (
          <Text style={{ color: sol ? '#FFFFFF' : deco && deco.tagColor ? deco.tagColor : c.fg, fontSize: 10.5, fontWeight: deco && deco.tag ? '700' : '400', minHeight: 14 }}>
            {deco && deco.tag ? deco.tag : care ? '' : e.sub}
          </Text>
        )}
        {sol ? <Text style={{ position: 'absolute', top: 2, right: 3, color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>✓</Text> : null}
        {ev && ev.some((x) => x.kind !== 'meet') ? (
          <View style={{ position: 'absolute', bottom: 5, left: 5, flexDirection: 'row', gap: 2 }}>
            {ev.filter((x) => x.kind !== 'meet').slice(0, 3).map((x, i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: x.color }} />)}
          </View>
        ) : null}
        {e.e && e.e.memo ? <View style={{ position: 'absolute', bottom: 5, right: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: c.fg }} /> : null}
      </Pressable>,
    );
  }

  const body = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Btn small ghost label="‹" onPress={() => move(-1)} style={{ minWidth: 40 }} />
        <Text style={{ flex: 1, color: t.ink, fontSize: 21, fontWeight: '600' }}>{view.y}년 {view.m}월</Text>
        <Btn small ghost label="오늘" onPress={() => { const p = parse(today); setView({ y: p[0], m: p[1] }); }} />
        <Btn small ghost label="›" onPress={() => move(1)} style={{ minWidth: 40 }} />
      </View>
      <View onLayout={(ev: LayoutChangeEvent) => setGridW(ev.nativeEvent.layout.width)} style={webTouch} {...swipe.panHandlers}>
        <View style={{ flexDirection: 'row', gap: GAP, marginBottom: 4 }}>
          {WD.map((w, i) => (
            <Text key={w} style={{ width: cellW, textAlign: 'center', fontSize: 12, color: i === 0 ? t.sun : i === 6 ? t.sat : t.ink2 }}>{w}</Text>
          ))}
        </View>
        {(() => {
          const padded = cells.slice();
          while (padded.length % 7) padded.push(<View key={'e' + padded.length} style={{ width: cellW, height: 4 }} />);
          const weeks: React.ReactElement[][] = [];
          for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
          return weeks.map((w, wi) => <View key={'w' + wi} style={{ flexDirection: 'row', columnGap: GAP }}>{w}</View>);
        })()}
      </View>
      <Text style={{ color: t.ink2, fontSize: 11.5, marginTop: 2 }}>달력을 좌우로 밀면 달이 바뀝니다.</Text>
      {meetList.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
          {meetList.map((h, i) => (
            <Text key={i} style={{ color: t.ink2, fontSize: 12.5 }}><Text style={{ color: t.meet, fontWeight: '700' }}>{h.d}일 모임 </Text>{h.name}</Text>
          ))}
        </View>
      ) : null}
      {evNames.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
          {evNames.map((h, i) => (
            <Text key={i} style={{ color: t.ink2, fontSize: 12.5 }}><Text style={{ color: h.color, fontWeight: '700' }}>● {h.d}일 </Text>{h.group ? h.group + ' · ' : ''}{h.name}</Text>
          ))}
        </View>
      ) : null}
      {hols.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
          {hols.map((h) => (
            <Text key={h.d} style={{ color: t.ink2, fontSize: 12.5 }}><Text style={{ color: t.sun, fontWeight: '700' }}>{h.d}일 </Text>{h.name}</Text>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
        {(['duty', 'off', 'leave', 'edu', 'swap'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 11, height: 11, borderRadius: 3, borderWidth: 1, borderColor: kindColors(t, k).fg, backgroundColor: k === 'duty' ? t.duty : kindColors(t, k).bg }} />
            <Text style={{ color: t.ink2, fontSize: 12 }}>{LBL[k]}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 11, height: 11, borderRadius: 3, borderWidth: 2, borderColor: t.hol }} />
          <Text style={{ color: t.ink2, fontSize: 12 }}>공휴일</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 11, height: 11, borderRadius: 3, borderWidth: 2, borderColor: t.meet, backgroundColor: t.meet }} />
          <Text style={{ color: t.ink2, fontSize: 12 }}>확정된 모임</Text>
        </View>
      </View>
    </View>
  );
  return bare ? body : <Card>{body}</Card>;
}
