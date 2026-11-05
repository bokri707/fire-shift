import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, Text, TextInput, View, ViewStyle } from 'react-native';
import { holName } from './lib/holidays';
import { WD, daysInMonth, firstWd, fromIdx, idx, iso, parse } from './lib/date';
import { deletePoll, insertPoll, updatePoll } from './cloud';
import { EV_COLOR, eventTitle, eventsByDate, parseEvent } from './lib/events';
import { MEff, Person, mEff, mFree, roster } from './lib/shift';
import { markWrite, newId, useStore } from './store';
import { Poll } from './types';
import { kindColors, useTheme } from './theme';
import { Btn, Card, H2, Help, Hint } from './ui';

const PARTNER = '#2A3F6B';
/** 오늘 날짜 표시색 (선택 테두리와 구분) */
const TODAY = '#F59E0B';
/** 육아시간 색: 내 것은 항상 주황, 배우자 것은 항상 파랑. 그 밖의 사람은 아래 색을 이름순으로 씁니다. */
export const CARE_MINE = '#E67E22';
export const CARE_SPOUSE = '#1E88E5';
const CARE_OTHERS = ['#A67C00', '#795548', '#546E7A', '#9E9D24', '#8E24AA', '#00897B'];

export function careColor(all: { id: string; name: string; isMe?: boolean }[], id: string, spouseId?: string): string {
  const me = all.find((x) => x.isMe);
  if (me && me.id === id) return CARE_MINE;
  if (spouseId && id === spouseId) return CARE_SPOUSE;
  const rest = all.filter((x) => !x.isMe && x.id !== spouseId).sort((p, q) => (p.name < q.name ? -1 : p.name > q.name ? 1 : 0));
  return CARE_OTHERS[Math.max(0, rest.findIndex((x) => x.id === id)) % CARE_OTHERS.length];
}

export function CareDot({ color, size }: { color: string; size: number }): React.ReactElement {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' }}>
      {size >= 11 ? <Text style={{ fontSize: Math.round(size * 0.62), fontWeight: '800', color: '#fff', lineHeight: size - 1 }}>육</Text> : null}
    </View>
  );
}

/** 칸에 표시할 내용이 있는지 (당직·연가·교육·맞교대 근무·육아시간) */
function visible(e: MEff): boolean {
  return e.kind === 'duty' || e.kind === 'leave' || e.kind === 'edu' || (e.kind === 'swap' && e.works) || e.care !== '';
}

function CareBadge(): React.ReactElement {
  const t = useTheme();
  return <View style={{ backgroundColor: t.meet, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 }}><Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>육</Text></View>;
}

function Mark({ e, color }: { e: MEff; color: string }): React.ReactElement {
  const t = useTheme();
  const c = kindColors(t, e.kind);
  const duty = e.kind === 'duty';
  const txt = e.kind === 'swap' ? (e.works ? (e.cover ? '보' : '맞') : '') : e.kind === 'leave' ? '연' : e.kind === 'edu' ? (e.part ? e.part : e.why.slice(0, 1)) : duty ? '당' : '';
  return (
    <View style={{ height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 12, backgroundColor: duty ? color : 'transparent', borderWidth: !duty && txt ? 1.5 : 0, borderColor: !duty && txt ? c.fg : 'transparent' }}>
      {e.care === 'in' || e.care === 'both' ? <CareBadge /> : null}
      {txt ? <Text style={{ fontSize: 13, fontWeight: '800', color: duty ? '#fff' : c.fg }}>{txt}</Text> : null}
      {e.care === 'out' || e.care === 'both' ? <CareBadge /> : null}
    </View>
  );
}

function Weeks({ cells }: { cells: React.ReactElement[] }): React.ReactElement {
  const t = useTheme();
  const list = cells.slice();
  while (list.length % 7) list.push(<View key={'e' + list.length} style={{ flex: 1 }} />);
  const weeks: React.ReactElement[][] = [];
  for (let i = 0; i < list.length; i += 7) weeks.push(list.slice(i, i + 7));
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {WD.map((w, i) => <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: i === 0 ? t.sun : i === 6 ? t.sun : t.ink2 }}>{w}</Text>)}
      </View>
      {weeks.map((w, wi) => <View key={'w' + wi} style={{ flexDirection: 'row', gap: 3 }}>{w}</View>)}
    </>
  );
}

function Dot({ color, label, square }: { color: string; label: string; square?: boolean }): React.ReactElement {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 14, height: 14, borderRadius: square ? 4 : 7, backgroundColor: color, borderWidth: square ? 1 : 0, borderColor: t.line }} />
      <Text style={{ color: t.ink, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

function Chips({ items, value, onPick }: { items: { id: string; label: string }[]; value: string; onPick: (id: string) => void }): React.ReactElement {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {items.map((m) => (
        <Pressable key={m.id} onPress={() => onPick(m.id)} style={{ borderWidth: 1, borderColor: m.id === value ? t.accent : t.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: m.id === value ? t.accent : 'transparent' }}>
          <Text style={{ color: m.id === value ? t.onAccent : t.ink, fontSize: 13 }}>{m.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** 그날 한 사람의 근무·상태를 한 줄 글로 (예: "기타 (원래 당직) · 육아시간(퇴근 때)") */
function dayText(e: MEff): string {
  const parts: string[] = [];
  if (e.kind === 'leave') parts.push('연가 (원래 ' + e.label + ')');
  else if (e.kind === 'edu') parts.push((e.why || '교육') + ' (원래 ' + e.label + ')');
  else if (e.cover) parts.push('보강 근무 (원래 ' + e.label + ')');
  else if (e.kind === 'swap') parts.push('맞교대 ' + (e.works ? '근무' : '쉼') + ' (원래 ' + e.label + ')');
  else parts.push(e.label);
  if (e.care === 'in') parts.push('육아시간(출근 때)');
  else if (e.care === 'out') parts.push('육아시간(퇴근 때)');
  else if (e.care === 'both') parts.push('육아시간(출근·퇴근 모두)');
  return parts.join(' · ');
}

/** 우리 팀(같은 팀 번호) 사람들 중 근무에서 빠지는 인원(연가·교육·출장·기타)을 날짜별로 세어 보여줍니다. */
function TeamView({ all, today, y, m, code, myId, polls, plan, partner, spouseId }: { all: Person[]; today: string; y: number; m: number; code: string; myId: string; polls: Poll[]; plan: boolean; partner?: Person; spouseId?: string }): React.ReactElement {
  const t = useTheme();
  const { update, reportErr } = useStore();
  const ev = eventsByDate(polls);
  const [evName, setEvName] = useState('');
  const [evDays, setEvDays] = useState(1);
  const [delId, setDelId] = useState<string | null>(null);
  /** 수정 중인 팀 일정 id (없으면 새 일정 올리기) */
  const [editId, setEditId] = useState<string | null>(null);
  const meP = all.find((x) => x.isMe) as Person;
  const teamNos = Array.from(new Set(all.map((x) => x.team))).sort((a, b) => a - b);
  const [tm, setTm] = useState<number>(meP.team);
  const [sel, setSel] = useState<string>('');

  const team = all.filter((x) => x.team === tm);

  const addEvent = (): void => {
    if (!sel) return;
    const nm = evName.trim() || '일정';
    const days: string[] = [];
    for (let i = 0; i < evDays; i++) days.push(fromIdx(idx(sel) + i));
    const id = 'p' + myId + '.' + newId();
    const title = eventTitle('plain', nm);
    update((s) => ({ ...s, myPolls: [id, ...(s.myPolls || [])], polls: [{ id, title, dates: days, final: days[0], at: Date.now(), votes: {} }, ...s.polls] }));
    markWrite();
    insertPoll(code, { id, title, dates: days })
      .then(() => { markWrite(); return updatePoll(code, id, { final: days[0] }); })
      .catch(() => reportErr('일정을 서버에 올리지 못했습니다.'));
    setEvName(''); setEvDays(1);
  };
  const delEvent = (id: string): void => {
    if (delId !== id) { setDelId(id); setTimeout(() => setDelId((c) => (c === id ? null : c)), 4000); return; }
    setDelId(null);
    if (editId === id) { setEditId(null); setEvName(''); setEvDays(1); }
    update((s) => ({ ...s, polls: s.polls.filter((x) => x.id !== id) }));
    markWrite();
    deletePoll(code, id).catch(() => reportErr('서버에서 지우지 못했습니다.'));
  };
  const startEdit = (id: string, name: string): void => {
    const p = polls.find((x) => x.id === id);
    if (!p) return;
    setEditId(id); setEvName(name); setEvDays(Math.min(Math.max(p.dates.length, 1), 14));
  };
  const cancelEdit = (): void => { setEditId(null); setEvName(''); setEvDays(1); };
  /** 이름과 기간만 고칩니다. 시작일은 그대로 두고, 기간(며칠 동안)에 맞춰 날짜를 다시 만듭니다. */
  const saveEdit = (): void => {
    if (!editId) return;
    const p = polls.find((x) => x.id === editId);
    if (!p || !p.dates.length) { cancelEdit(); return; }
    const kind = parseEvent(p)?.kind ?? 'plain';
    const title = eventTitle(kind, evName.trim() || '일정');
    const days: string[] = [];
    for (let i = 0; i < evDays; i++) days.push(fromIdx(idx(p.dates[0]) + i));
    const id = editId;
    update((s) => ({ ...s, polls: s.polls.map((x) => (x.id === id ? { ...x, title, dates: days } : x)) }));
    markWrite();
    updatePoll(code, id, { title, dates: days }).catch(() => reportErr('일정을 서버에 저장하지 못했습니다.'));
    cancelEdit();
  };
  // 다른 날짜를 누르면 수정 중이던 입력을 닫습니다.
  useEffect(() => { if (editId) { setEditId(null); setEvName(''); setEvDays(1); } }, [sel]);

  // 사람별 색: 이름순으로 정해서 모든 사람의 폰에서 같은 색이 됩니다.
  const colorOf = (id: string): string => careColor(all, id, spouseId);
  const careOf = (s: string): { inn: Person[]; out: Person[] } => {
    const inn: Person[] = []; const out: Person[] = [];
    team.slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).forEach((p) => {
      const e = mEff(p, s);
      if (e.base !== 'duty' || !e.care) return;
      if (e.care === 'in' || e.care === 'both') inn.push(p);
      if (e.care === 'out' || e.care === 'both') out.push(p);
    });
    return { inn, out };
  };
  const dots = (list: Person[]): React.ReactElement => (
    <View style={{ flexDirection: 'row' }}>
      {list.slice(0, 3).map((p, i) => <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -5 }}><CareDot color={colorOf(p.id)} size={15} /></View>)}
    </View>
  );

  const info = (s: string): { N: number; L: number; names: string[] } => {
    let N = 0; let L = 0; const names: string[] = [];
    team.forEach((p) => {
      const e = mEff(p, s);
      if (e.base !== 'duty') return;
      N++;
      if (e.kind === 'leave' || e.kind === 'edu') { L++; names.push(p.name + '(' + e.why + ')'); }
    });
    return { N, L, names };
  };

  const first = firstWd(y, m);
  const n = daysInMonth(y, m);
  const cells: React.ReactElement[] = [];
  for (let i = 0; i < first; i++) cells.push(<View key={'b' + i} style={{ flex: 1 }} />);
  for (let d = 1; d <= n; d++) {
    const s = iso(y, m, d);
    const { N, L } = info(s);
    const cr = careOf(s);
    const isToday = s === today;
    const wd = (first + d - 1) % 7;
    const hn = holName(s);
    const pb = partner ? mEff(partner, s) : null;
    const noCare = !!(partner && !mFree(meP, s, false) && !mFree(partner, s, false));
    const bg = partner ? t.surface : !plan ? t.surface : L > 0 ? '#DCEFE6' : N > 0 ? '#EEF1F4' : t.surface;
    const fg = t.leave;
    cells.push(
      <Pressable key={s} onPress={() => setSel(s)} style={{ flex: 1, minHeight: 80, padding: 3, borderRadius: 8, borderWidth: isToday || sel === s || noCare ? 2 : 1, borderColor: sel === s ? t.accent : noCare ? t.bad : isToday ? TODAY : t.line, backgroundColor: bg }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: isToday ? '#1B1B1B' : hn || wd === 0 || wd === 6 ? t.sun : t.ink, paddingLeft: 2, ...(isToday ? { backgroundColor: TODAY, alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 4, overflow: 'hidden' } : {}) }}>{d}</Text>
        {plan && !partner && mEff(meP, s).kind === 'duty' ? (
          <View style={{ alignSelf: 'center', marginTop: 3, height: 20, minWidth: 30, paddingHorizontal: 6, borderRadius: 6, backgroundColor: t.duty, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: t.onDuty }}>당</Text>
          </View>
        ) : null}
        {hn ? <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: '700', color: t.sun, paddingLeft: 2 }}>{hn}</Text> : null}
        {partner || !plan ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: 3 }}>
            {visible(mEff(meP, s)) ? <Mark e={mEff(meP, s)} color={t.duty} /> : null}
            {pb && visible(pb) ? <Mark e={pb} color={PARTNER} /> : null}
          </View>
        ) : null}
        <View style={{ flex: partner || !plan ? 0 : 1, alignItems: 'center', justifyContent: 'center' }}>
          {plan && L > 0 ? <View style={{ minWidth: 26, height: 26, paddingHorizontal: 6, borderRadius: 13, backgroundColor: fg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 15, fontWeight: '800', color: t.onDuty }}>{L}</Text></View> : null}
        </View>
        {ev[s] ? (
          <View style={{ flexDirection: 'row', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            {ev[s].slice(0, 3).map((e) => <View key={e.id} style={{ backgroundColor: e.color, borderRadius: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>{e.short}</Text></View>)}
          </View>
        ) : null}
        {plan ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', minHeight: 15 }}>
            {dots(cr.inn)}
            {dots(cr.out)}
          </View>
        ) : null}
      </Pressable>,
    );
  }

  const si = sel ? info(sel) : null;
  const sp = sel ? parse(sel) : null;
  return (
    <>
      {plan && teamNos.length > 1 ? <Chips items={teamNos.map((x) => ({ id: String(x), label: x + '팀' }))} value={String(tm)} onPick={(id) => { setTm(Number(id)); setSel(''); }} /> : null}
      {plan ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Dot color="#EEF1F4" label="팀 근무일" square />
        <Dot color="#DCEFE6" label="빠짐 (숫자=빠지는 인원)" square />
        {!partner ? <Dot color={t.duty} label="내 당직" square /> : null}
      </View> : null}
      {partner ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Dot color={t.duty} label="나" />
          <Dot color={PARTNER} label={partner.name} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 14, height: 14, borderRadius: 4, borderWidth: 2, borderColor: t.bad }} />
            <Text style={{ color: t.ink, fontSize: 13 }}>근무 겹침</Text>
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Dot color={EV_COLOR.plain} label={plan ? '팀 일정' : '일정'} square />
        <Dot color={EV_COLOR.meet} label="확정된 모임" square />
      </View>
      {plan ? <View style={{ gap: 6 }}>
        <Help>        <Text style={{ color: t.ink, fontSize: 13 }}>육아시간: 칸의 <Text style={{ fontWeight: '800' }}>왼쪽 아래 모서리는 출근</Text> 때, <Text style={{ fontWeight: '800' }}>오른쪽 아래 모서리는 퇴근</Text> 때 쓰는 사람입니다.</Text></Help>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {team.slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <CareDot color={colorOf(p.id)} size={16} />
              <Text style={{ color: t.ink, fontSize: 13 }}>{p.name}</Text>
            </View>
          ))}
        </View>
      </View> : null}
      <Weeks cells={cells} />
      {partner && sel && sp ? (
        <View style={{ gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
          <Text style={{ color: t.ink, fontSize: 15, fontWeight: '700' }}>{sp[1]}월 {sp[2]}일 근무</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.duty }} />
            <Text style={{ flex: 1, color: t.ink, fontSize: 14 }}><Text style={{ fontWeight: '700' }}>{meP.name}</Text>  {dayText(mEff(meP, sel))}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: PARTNER }} />
            <Text style={{ flex: 1, color: t.ink, fontSize: 14 }}><Text style={{ fontWeight: '700' }}>{partner.name}</Text>  {dayText(mEff(partner, sel))}</Text>
          </View>
        </View>
      ) : null}
      {plan && si && sp ? (
        <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 10, padding: 12, gap: 8, marginTop: 10 }}>
          <Text style={{ color: t.ink, fontSize: 16, fontWeight: '800' }}>{sp[1]}월 {sp[2]}일 · {si.N === 0 ? '이 팀은 근무하지 않는 날' : '근무 ' + si.N + '명 중 ' + si.L + '명 빠짐'}</Text>
          {si.N > 0 ? (si.names.length ? (
            <View style={{ gap: 6 }}>
              {si.names.map((nm, i) => {
                const mm = /^(.*)\((.*)\)$/.exec(nm);
                const who = mm ? mm[1] : nm; const why = mm ? mm[2] : '';
                const c = kindColors(t, 'leave');
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {why ? <View style={{ backgroundColor: c.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: c.fg }}><Text style={{ color: c.fg, fontSize: 13, fontWeight: '800' }}>{why}</Text></View> : null}
                    <Text style={{ color: t.ink, fontSize: 16, fontWeight: '700' }}>{who}</Text>
                  </View>
                );
              })}
            </View>
          ) : <Text style={{ color: t.ink2, fontSize: 14 }}>빠지는 사람 없음</Text>) : null}
          {(() => {
            const cr = sel ? careOf(sel) : { inn: [], out: [] };
            const people = Array.from(new Set(cr.inn.concat(cr.out)));
            if (!people.length) return null;
            return (
              <View style={{ gap: 4, paddingTop: 2 }}>
                <Text style={{ color: t.ink2, fontSize: 13 }}>육아시간 {people.length}명</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {people.map((p) => (
                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <CareDot color={colorOf(p.id)} size={16} />
                      <Text style={{ color: t.ink, fontSize: 13 }}>{p.name}({cr.inn.indexOf(p) >= 0 && cr.out.indexOf(p) >= 0 ? '출근·퇴근' : cr.inn.indexOf(p) >= 0 ? '출근' : '퇴근'})</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
        </View>
      ) : <Help><Text style={{ color: t.ink2, fontSize: 13 }}>{plan ? '날짜를 누르면 그날 빠지는 사람과 남은 인원이 나오고, 팀 일정(직장교육·회식 등)도 올릴 수 있습니다.' : '날짜를 누르면 그날 일정을 보고 올릴 수 있습니다.'}</Text></Help>}
      {sel ? (
        <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, gap: 8, marginTop: 10 }}>
          <Text style={{ color: t.ink, fontSize: 14, fontWeight: '700' }}>{sp ? sp[1] + '월 ' + sp[2] + '일' : ''} {plan ? '팀 일정' : '모임 일정'}</Text>
          {(ev[sel] || []).length === 0 ? <Help><Text style={{ color: t.ink2, fontSize: 13 }}>올라온 일정이 없습니다. 아래에 이름만 입력하면 됩니다.</Text></Help> : null}
          {(ev[sel] || []).map((e) => {
            const mine = e.id.indexOf('p' + myId + '.') === 0;
            const canEdit = mine && e.kind !== 'meet';
            return (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable disabled={!canEdit} onPress={() => startEdit(e.id, e.name)} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: e.color, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{e.label}</Text></View>
                  <Text style={{ flex: 1, color: editId === e.id ? t.accent : t.ink, fontSize: 14, fontWeight: editId === e.id ? '700' : '400' }}>{e.name}</Text>
                </Pressable>
                {canEdit ? (
                  <Pressable onPress={() => delEvent(e.id)} accessibilityRole="button">
                    <Text style={{ color: delId === e.id ? t.bad : t.ink2, fontSize: 12.5 }}>{delId === e.id ? '한 번 더 눌러 삭제' : '삭제'}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {(ev[sel] || []).some((e) => e.kind !== 'meet' && e.id.indexOf('p' + myId + '.') === 0) ? <Help><Text style={{ color: t.ink2, fontSize: 12 }}>내가 올린 일정은 이름을 눌러 수정할 수 있습니다.</Text></Help> : null}
          <View style={{ gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.line }}>
            <Text style={{ color: editId ? t.accent : t.ink2, fontSize: 12, fontWeight: editId ? '700' : '400' }}>
              {editId
                ? '일정 수정 — ' + (() => { const p = polls.find((x) => x.id === editId); const q = p && p.dates[0] ? parse(p.dates[0]) : null; return q ? q[1] + '월 ' + q[2] + '일부터' : ''; })() + ' (시작일은 바뀌지 않습니다)'
                : '이 날부터 일정 올리기'}
            </Text>
            <TextInput
              value={evName} onChangeText={setEvName} maxLength={30} placeholder="일정 이름을 입력하세요"
              placeholderTextColor={t.ink2}
              style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, color: t.ink, fontSize: 14 }}>며칠 동안: <Text style={{ fontWeight: '800' }}>{evDays}일</Text></Text>
              <Btn small ghost label="−" onPress={() => setEvDays(Math.max(1, evDays - 1))} style={{ minWidth: 40 }} />
              <Btn small ghost label="+" onPress={() => setEvDays(Math.min(14, evDays + 1))} style={{ minWidth: 40 }} />
            </View>
            {editId ? (
              <View style={{ gap: 8 }}>
                <Btn label="수정 저장" onPress={saveEdit} />
                <Btn small ghost label="취소" onPress={cancelEdit} />
              </View>
            ) : <Btn label="일정 올리기" onPress={addEvent} />}
          </View>
        </View>
      ) : null}
      {plan ? <Hint>칸의 숫자는 그날 빠지는 사람 수입니다. 연가·병가·교육·출장·기타로 근무에서 빠지는 사람을 모두 세며, 주간·야간만 빠지는 경우도 포함합니다. 날짜를 누르면 이름과 주·야 구분이 나옵니다. 팀원끼리 계획을 미리 입력해 서로 보면서 조율하는 용도입니다.</Hint> : <Hint>{partner ? '붉은색은 나, 남색은 ' + partner.name + '입니다. 한 칸에 위(나)·아래(상대)로 나옵니다. 빨간 테두리는 두 사람 모두 당직·교육·출장·기타로 근무가 겹치는 날입니다. 칸의 육은 육아시간이고, 당 앞은 출근 때, 당 뒤는 퇴근 때입니다. 일정은 소모임 모두에게 보입니다. ' : '모임 일정은 같은 소모임에 들어온 사람 모두에게 보입니다. '}모임 날짜를 투표로 정하려면 "모임·투표"를 쓰세요.</Hint>}
    </>
  );
}

function MonthNav({ view, move }: { view: { y: number; m: number }; move: (d: number) => void }): React.ReactElement {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Btn small ghost label="‹" onPress={() => move(-1)} style={{ minWidth: 40 }} />
      <Text style={{ flex: 1, color: t.ink, fontSize: 18, fontWeight: '600' }}>{view.y}년 {view.m}월</Text>
      <Btn small ghost label="›" onPress={() => move(1)} style={{ minWidth: 40 }} />
    </View>
  );
}

function useMonth(startOffset: number): { view: { y: number; m: number }; move: (d: number) => void; swipe: object } {
  const { today } = useStore();
  const p0 = parse(today);
  const [view, setView] = useState(() => {
    let m = p0[1] + startOffset; let y = p0[0];
    if (m > 12) { m = 1; y++; }
    return { y, m };
  });
  const move = (d: number): void => {
    setView((v) => {
      let m = v.m + d; let y = v.y;
      if (m < 1) { m = 12; y--; }
      if (m > 12) { m = 1; y++; }
      return { y, m };
    });
  };
  // 좌우로 밀면 달이 바뀝니다. (왼쪽으로 밀면 다음 달)
  const moveRef = useRef(move);
  moveRef.current = move;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_e, g) => {
      if (g.dx <= -50) moveRef.current(1);
      else if (g.dx >= 50) moveRef.current(-1);
    },
  }), []);
  const webTouch = (Platform.OS === 'web' ? { touchAction: 'pan-y' } : {}) as unknown as ViewStyle;
  return { view, move, swipe: { ...pan.panHandlers, style: webTouch } };
}

/** 팀·모임 탭: 이번 달부터 보는 우리 팀 연가계획표 */
export function TeamLeaveCard(): React.ReactElement | null {
  const { state, today } = useStore();
  const { view, move, swipe } = useMonth(0);
  if (!state.cloud) return null;
  const plan = state.cloud.kind !== 'meet';
  const ms = roster(state);
  const others = ms.filter((x) => !x.isMe);
  const partner = !plan && state.cloud.pair === true ? others[0] : undefined;
  return (
    <Card style={{ gap: 10 }}>
      <H2>{plan ? '우리 팀 연가계획표' : '모임 일정'}</H2>
      {others.length === 0 ? (
        <Hint>{plan ? '같은 소모임에 팀원이 들어오면 팀원들의 연가·교육·출장 계획을 한 달력에서 보고, 날짜별로 빠지는 인원을 미리 알 수 있습니다. 위의 소모임 코드로 팀원을 초대하세요.' : '같은 소모임에 사람이 들어오면 모임 일정을 한 달력에서 함께 볼 수 있습니다. 위의 소모임 코드로 초대하세요.'}</Hint>
      ) : (
        <>
          <MonthNav view={view} move={move} />
          <View {...swipe}><TeamView all={ms} today={today} y={view.y} m={view.m} code={state.cloud.code} myId={state.cloud.myId} polls={state.polls} plan={plan} partner={partner} spouseId={state.cloud.pair === true ? others[0]?.id : undefined} /></View>
        </>
      )}
    </Card>
  );
}
