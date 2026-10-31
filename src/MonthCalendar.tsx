import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Platform, Pressable, Text, View, ViewStyle } from 'react-native';
import { WD, daysInMonth, firstWd, iso, parse } from './lib/date';
import { holName } from './lib/holidays';
import { GROUP_COLORS, PERSONAL_COLOR, eventsByDate, personalByDate } from './lib/events';
import { Poll } from './types';
import { LBL, allMeets, eff, hasManyGroups, mEff } from './lib/shift';
import { spouseOf, useStore } from './store';
import { kindColors, useTheme } from './theme';
import { Btn, Card, Help } from './ui';

const GAP = 4;
/** 육아시간 점: 내 것은 주황, 배우자 것은 파랑 (왼쪽은 출근 때, 오른쪽은 퇴근 때) */
/** 오늘 날짜 표시색: 선택·모임 테두리(남색·주황)와 겹치지 않는 노란색 */
const TODAY = '#F59E0B';
const CARE_MINE = '#E67E22';
const CARE_SPOUSE = '#1E88E5';


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
  const [listMode, setListMode] = useState(false);
  const [listAll, setListAll] = useState(false);

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
  const spouse = spouseOf(state);
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
  const pby = personalByDate(state.myEvents);
  Object.keys(pby).forEach((d) => pby[d].forEach((x) => {
    (evs[d] = evs[d] || []).push({ name: x.name, color: PERSONAL_COLOR, group: many ? '내 일정' : '', kind: 'plain' });
  }));
  let careAny = false;
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
    const sc = spouse ? mEff(spouse, s).care : '';
    const spL = sc === 'in' || sc === 'both';
    const spR = sc === 'out' || sc === 'both';
    const dotsL = [careL ? CARE_MINE : '', spL ? CARE_SPOUSE : ''].filter(Boolean);
    const dotsR = [careR ? CARE_MINE : '', spR ? CARE_SPOUSE : ''].filter(Boolean);
    if (dotsL.length || dotsR.length) careAny = true;
    const sol = deco && deco.solid ? deco.solid : '';
    const numColor = isToday ? '#1B1B1B' : sol ? '#FFFFFF' : hn || wk === 0 ? t.sun : wk === 6 ? t.sun : t.ink;
    const borderColor = isToday ? TODAY : sol ? sol : deco && deco.border ? deco.border : mt ? t.meet : hn ? t.hol : t.line;
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
        <View style={{ alignSelf: 'flex-start', marginLeft: 1, minWidth: 20, paddingHorizontal: 4, borderRadius: 5, backgroundColor: isToday ? TODAY : 'transparent' }}>
          <Text style={{ color: numColor, fontSize: 12, fontWeight: '700', lineHeight: 18, textAlign: 'center' }}>{d}</Text>
        </View>
        {hn ? <Text numberOfLines={1} style={{ color: sol ? '#FFFFFF' : t.sun, fontSize: 9, fontWeight: '700', lineHeight: 11, textAlign: 'center' }}>{hn}</Text> : null}
        <View style={{
          minWidth: 24, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, alignItems: 'center',
          backgroundColor: e.kind === 'duty' ? t.duty : e.kind === 'off' ? 'transparent' : c.bg,
        }}>
          <Text style={{
            fontSize: 12, fontWeight: e.kind === 'off' ? '500' : '700',
            color: e.kind === 'duty' ? t.onDuty : sol ? '#FFFFFF' : e.kind === 'off' ? t.ink2 : c.fg,
          }}>{chipText}</Text>
          {dotsL.map((c, i) => <View key={'l' + i} style={{ position: 'absolute', top: '50%', marginTop: dotsL.length > 1 ? (i === 0 ? -7 : 1) : -3, left: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />)}
          {dotsR.map((c, i) => <View key={'r' + i} style={{ position: 'absolute', top: '50%', marginTop: dotsR.length > 1 ? (i === 0 ? -7 : 1) : -3, right: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />)}
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
      </Pressable>,
    );
  }

  // 월간 목록: 날짜 순서대로 위에서 아래로 나열합니다.
  const canList = !bare && !decorate;
  const listRows: React.ReactElement[] = [];
  if (listMode && canList) {
    for (let d = 1; d <= n; d++) {
      const s = iso(view.y, view.m, d);
      const e = eff(state, s);
      const wk = (first + d - 1) % 7;
      const hn = holName(s);
      const evl = evs[s] || [];
      const mtl = meets[s] || [];
      const scare = spouse ? mEff(spouse, s).care : '';
      const scText = scare === 'in' ? '출근 때' : scare === 'out' ? '퇴근 때' : scare === 'both' ? '출근·퇴근' : '';
      const hasAny = evl.length > 0 || mtl.length > 0 || !!hn || !!scText;
      if (!listAll && !hasAny) continue;
      const isToday = s === today;
      const c = kindColors(t, e.kind);
      const dayColor = hn || wk === 0 || wk === 6 ? t.sun : t.ink;
      listRows.push(
        <Pressable
          key={s}
          accessibilityRole="button"
          accessibilityLabel={view.m + '월 ' + d + '일 ' + e.label}
          onPress={() => onPressDate(s)}
          style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9, paddingHorizontal: 6,
            borderTopWidth: 1, borderTopColor: t.line, borderRadius: isToday ? 6 : 0,
            borderWidth: isToday ? 2 : 0, borderColor: TODAY,
          }}
        >
          <View style={{ width: 44, alignItems: 'center' }}>
            <Text style={{ color: dayColor, fontSize: 18, fontWeight: '700' }}>{d}</Text>
            <Text style={{ color: dayColor, fontSize: 11 }}>{WD[wk]}</Text>
          </View>
          <View style={{
            minWidth: 30, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignItems: 'center',
            backgroundColor: e.kind === 'duty' ? t.duty : e.kind === 'off' ? 'transparent' : c.bg,
          }}>
            <Text style={{ fontSize: 13, fontWeight: e.kind === 'off' ? '500' : '700', color: e.kind === 'duty' ? t.onDuty : e.kind === 'off' ? t.ink2 : c.fg }}>
              {e.label === '당직' ? '당' : e.label === '비번' ? '비' : e.label}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            {hn ? <Text style={{ color: t.sun, fontSize: 14, fontWeight: '700' }}>{hn}</Text> : null}
            {mtl.map((m, i) => (
              <Text key={'m' + i} style={{ color: t.ink, fontSize: 14 }}><Text style={{ color: t.meet, fontWeight: '700' }}>모임 </Text>{m.g ? m.g + ' · ' : ''}{m.t}</Text>
            ))}
            {evl.filter((x) => x.kind !== 'meet').map((x, i) => (
              <Text key={'e' + i} style={{ color: t.ink, fontSize: 14 }}><Text style={{ color: x.color, fontWeight: '700' }}>● </Text>{x.group ? x.group + ' · ' : ''}{x.name}</Text>
            ))}
            {e.sub ? <Text style={{ color: t.ink2, fontSize: 12.5 }}>{e.sub}</Text> : null}
            {scText ? <Text style={{ color: CARE_SPOUSE, fontSize: 12.5 }}>{spouse ? spouse.name : '배우자'} 육아시간({scText})</Text> : null}
          </View>
        </Pressable>,
      );
    }
  }

  const body = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Btn small ghost label="‹" onPress={() => move(-1)} style={{ minWidth: 40 }} />
        <Text style={{ flex: 1, color: t.ink, fontSize: 21, fontWeight: '600' }}>{view.y}년 {view.m}월</Text>
        {canList ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listMode ? '달력으로 보기' : '월간 일정 목록으로 보기'}
            onPress={() => setListMode((v) => !v)}
            style={{ width: 40, height: 36, borderRadius: 8, borderWidth: 1, borderColor: listMode ? t.ink : t.line, backgroundColor: listMode ? t.ink : 'transparent', alignItems: 'center', justifyContent: 'center', gap: 3 }}
          >
            {[0, 1, 2].map((i) => <View key={i} style={{ width: 18, height: 2.5, borderRadius: 2, backgroundColor: listMode ? t.surface : t.ink }} />)}
          </Pressable>
        ) : null}
        <Btn small ghost label="오늘" onPress={() => { const p = parse(today); setView({ y: p[0], m: p[1] }); }} />
        <Btn small ghost label="›" onPress={() => move(1)} style={{ minWidth: 40 }} />
      </View>
      {listMode && canList ? (
        <View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <Pressable onPress={() => setListAll(false)} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: !listAll ? t.ink : 'transparent' }}>
              <Text style={{ fontSize: 13, color: !listAll ? t.surface : t.ink }}>일정만</Text>
            </Pressable>
            <Pressable onPress={() => setListAll(true)} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: listAll ? t.ink : 'transparent' }}>
              <Text style={{ fontSize: 13, color: listAll ? t.surface : t.ink }}>전체 날짜</Text>
            </Pressable>
          </View>
          {listRows.length ? listRows : <Text style={{ color: t.ink2, fontSize: 14, paddingVertical: 16, textAlign: 'center' }}>이 달에는 등록된 일정이 없습니다.</Text>}
        </View>
      ) : null}
      <View style={listMode && canList ? { display: 'none' } : undefined}>
      <View onLayout={(ev: LayoutChangeEvent) => setGridW(ev.nativeEvent.layout.width)} style={webTouch} {...swipe.panHandlers}>
        <View style={{ flexDirection: 'row', gap: GAP, marginBottom: 4 }}>
          {WD.map((w, i) => (
            <Text key={w} style={{ width: cellW, textAlign: 'center', fontSize: 12, color: i === 0 ? t.sun : i === 6 ? t.sun : t.ink2 }}>{w}</Text>
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
      </View>
      <Help><Text style={{ color: t.ink2, fontSize: 11.5, marginTop: 2 }}>달력을 좌우로 밀면 달이 바뀝니다.</Text></Help>
      {careAny ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CARE_MINE }} />
            <Text style={{ color: t.ink2, fontSize: 12 }}>내 육아시간</Text>
          </View>
          {spouse ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CARE_SPOUSE }} />
              <Text style={{ color: t.ink2, fontSize: 12 }}>배우자 육아시간</Text>
            </View>
          ) : null}
          <Help><Text style={{ color: t.ink2, fontSize: 12 }}>칩 왼쪽은 출근 때, 오른쪽은 퇴근 때</Text></Help>
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
