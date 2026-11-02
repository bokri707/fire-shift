import React, { useState } from 'react';
import {
  KeyboardAvoidingView, LayoutChangeEvent, Modal, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { EXTRA_LEAVE, ExtraType, isExtra } from '../lib/leave';
import { DEFAULT_LEAVE, fmtLeave, leaveUsage } from '../lib/leaveCalc';
import { WD, fromIdx, idx, parse, wdOf } from '../lib/date';
import { downloadIcs, dutyIcs } from '../lib/ics';
import { holName } from '../lib/holidays';
import { deletePoll, insertPoll, updatePoll } from '../cloud';
import { PERSONAL_COLOR, eventTitle, groupEvents, personalByDate } from '../lib/events';
import { LBL, OFF_LABELS, WORK_LABELS, allMeets, dutyTeam, eff, hasManyGroups, isThree, ledger, mEff, posOf } from '../lib/shift';
import MonthCalendar from '../MonthCalendar';
import SetupCard from '../SetupCard';
import { markWrite, newId, spouseOf, useStore } from '../store';
import { useTheme } from '../theme';
import { Btn, Card, Chip, H2, Hint, HelpScope, Pill, SegRow } from '../ui';

export default function CalendarScreen(): React.ReactElement {
  const t = useTheme();
  const { state, today, update } = useStore();
  const lyear = parse(today)[0];
  const lu = leaveUsage(state, lyear);
  const [totalTxt, setTotalTxt] = useState(String(state.leaveTotal !== undefined ? state.leaveTotal : DEFAULT_LEAVE));
  const [sel, setSel] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | undefined>(undefined);
  const [showSetup, setShowSetup] = useState(false);

  const rows = ledger(state);
  const meets = allMeets(state).filter((p) => p.final >= today).sort((a, b) => (a.final < b.final ? -1 : 1));
  const many = hasManyGroups(state);
  const soon = meets.filter((m) => idx(m.final) - idx(today) <= 1);
  const evAll = groupEvents(state);
  const tmr = fromIdx(idx(today) + 1);
  const soonEv = ([['오늘', today], ['내일', tmr]] as const).flatMap(([lb, d]) => (evAll[d] || []).map((e) => ({ lb, ...e })));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {!state.configured || showSetup ? <HelpScope><SetupCard onDone={() => setShowSetup(false)} /></HelpScope> : null}
      {soon.length ? (
        <Card style={{ gap: 4, borderWidth: 2, borderColor: t.meet }}>
          {soon.map((m) => (
            <Text key={m.id} style={{ color: t.meet, fontSize: 16, fontWeight: '700' }}>
              {idx(m.final) === idx(today) ? '오늘' : '내일'} 모임 · {many ? m.group + ' · ' : ''}{m.title}
            </Text>
          ))}
        </Card>
      ) : null}
      {soonEv.length ? (
        <Card style={{ gap: 6 }}>
          {soonEv.map((e, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: e.color }} />
              <Text style={{ flex: 1, color: t.ink, fontSize: 15 }}>
                <Text style={{ fontWeight: '700', color: e.color }}>{e.lb} 일정 </Text>{e.group ? e.group + ' · ' : ''}{e.name}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <MonthCalendar onPressDate={setSel} focusDate={focus} />

      <Card style={{ gap: 10 }}>
        <H2>맞교대 장부</H2>
        {rows.length === 0 ? (
          <Hint>달력에서 날짜를 눌러 맞교대를 기록하면 갚을 날과 받을 날이 여기에 계산됩니다.</Hint>
        ) : rows.map((r) => (
          <View key={r.who} style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.line }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: t.ink, fontWeight: '700' }}>{r.who}</Text>
              <Pill kind={r.net > 0 ? 'leave' : r.net < 0 ? 'duty' : 'off'} text={r.net > 0 ? '받을 날 ' + r.net + '일' : r.net < 0 ? '갚을 날 ' + Math.abs(r.net) + '일' : '정산 완료'} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {r.items.map((it) => {
                const p = parse(it.iso);
                return (
                  <Pressable
                    key={it.iso}
                    onPress={() => { setFocus(it.iso + ':' + Date.now()); setSel(it.iso); }}
                    style={{ borderWidth: 1, borderColor: t.line, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <Text style={{ color: t.ink, fontSize: 12.5 }}>{p[1]}/{p[2]} {it.covered ? '상대가 근무' : '내가 근무'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 10 }}>
        <H2>{lyear}년 남은 연가</H2>
        <Text style={{ color: lu.remainH < 0 ? t.sun : t.ink, fontSize: 28, fontWeight: '800' }}>{fmtLeave(lu.remainH)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: t.ink, fontSize: 14 }}>한 해 연가</Text>
          <TextInput
            value={totalTxt}
            keyboardType="numeric"
            maxLength={4}
            onChangeText={(v: string) => {
              setTotalTxt(v);
              const n = parseFloat(v.replace(',', '.'));
              if (isFinite(n) && n >= 0 && n <= 99) update((s) => ({ ...s, leaveTotal: n }));
            }}
            style={{ width: 64, borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 8, color: t.ink, textAlign: 'center' }}
          />
          <Text style={{ color: t.ink, fontSize: 14 }}>일 (사용 {fmtLeave(lu.usedH)})</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="24시간 근무자로 계산" on={lu.is24} onPress={() => update((s) => ({ ...s, leave24: !lu.is24 }))} />
        </View>
        <View style={{ gap: 3 }}>
          <Text style={{ color: t.ink2, fontSize: 13 }}>전일연가 {lu.full}회 → {fmtLeave(lu.fullUsedH)}</Text>
          <Text style={{ color: t.ink2, fontSize: 13 }}>반일연가 {lu.half}회 → {fmtLeave(lu.half * lu.halfH)}</Text>
          <Text style={{ color: t.ink2, fontSize: 13 }}>시간연가 {lu.hourly}시간 (8시간 = 1일)</Text>
          <Text style={{ color: t.ink2, fontSize: 13 }}>가족돌봄 {lu.family} / 10일{lu.absent ? ' · 결근 ' + lu.absent + '회(연가 공제)' : ''}</Text>
          <Text style={{ color: t.ink2, fontSize: 13 }}>병가(진단서 없음) {lu.sickDays}일{lu.sickExcess ? ' → 6일 초과 ' + lu.sickExcess + '일을 연가에서 공제' : ' (연 6일까지는 공제 없음)'}</Text>
        </View>
      </Card>

      {Platform.OS === 'web' ? (
        <Card style={{ gap: 10 }}>
          <H2>근무 알림</H2>
          <Hint>앞으로 60일 중 내 근무일을 폰 캘린더에 넣고, 근무 전날 저녁 9시에 알려줍니다. 근무표나 맞교대를 바꾸면 다시 받아서 열어 주세요.</Hint>
          <Btn small label="내 캘린더에 근무 알림 추가" onPress={() => { downloadIcs('근무알림.ics', dutyIcs(state, today, 60)); }} />
        </Card>
      ) : null}

      {state.teamOn !== true && state.meetOn !== true && !state.cloud ? (
        <Hint>동료와 근무를 공유하거나 모임 투표를 하려면 설정 탭의 "기능 켜기"에서 팀이나 모임을 켜세요.</Hint>
      ) : null}

      <Text style={{ color: t.ink2, fontSize: 12, lineHeight: 18 }}>
        기록은 이 폰 안에만 저장됩니다. 기관 근무 규정과 다를 수 있으니 실제 근무표와 함께 확인하세요.
      </Text>

      {sel ? <EditorModal key={sel} date={sel} onClose={() => setSel(null)} /> : null}
    </ScrollView>
  );
}

type DraftType = ExtraType | 'hourly' | 'none' | 'leave' | 'edu' | 'dispatch' | 'etc' | 'swap' | 'cover' | 'careIn' | 'careOut' | 'careBoth';

type Tab = 'base' | 'leave' | 'sick' | 'special' | 'official' | 'care' | 'edu' | 'trip' | 'etc';
const TABS_A: { v: Tab; label: string }[] = [{ v: 'base', label: '기본' }, { v: 'leave', label: '연가' }, { v: 'sick', label: '병가' }, { v: 'special', label: '특별' }, { v: 'official', label: '공가' }];
const TABS_B: { v: Tab; label: string }[] = [{ v: 'care', label: '육아' }, { v: 'edu', label: '교육' }, { v: 'trip', label: '출장' }, { v: 'etc', label: '기타' }];
const TAB_DEFAULT: Record<Tab, DraftType> = { base: 'none', leave: 'leave', sick: 'sick', special: 'condol', official: 'official', care: 'careIn', edu: 'edu', trip: 'dispatch', etc: 'etc' };
function tabOf(ty: DraftType): Tab {
  if (ty === 'swap' || ty === 'cover' || ty === 'none') return 'base';
  if (ty === 'leave' || ty === 'halfAm' || ty === 'halfPm' || ty === 'hourly') return 'leave';
  if (ty === 'sick' || ty === 'sickCert' || ty === 'sickWork') return 'sick';
  if (ty === 'condol' || ty === 'family' || ty === 'dutyOff' || ty === 'subOff' || ty === 'turnOff') return 'special';
  if (ty === 'official') return 'official';
  if (ty === 'careIn' || ty === 'careOut' || ty === 'careBoth') return 'care';
  if (ty === 'edu') return 'edu';
  if (ty === 'dispatch') return 'trip';
  return 'etc';
}

function EditorModal({ date, onClose }: { date: string; onClose: () => void }): React.ReactElement {
  const t = useTheme();
  const { state, update, reportErr } = useStore();
  const e = eff(state, date);
  const p = parse(date);
  const cur = state.ex[date];
  const [type, setType] = useState<DraftType>(cur ? (cur.type === 'care' ? 'careOut' : cur.type === 'memo' ? 'none' : cur.type) : 'none');
  const [who, setWho] = useState(cur ? cur.who : '');
  const [memo, setMemo] = useState(cur ? cur.memo : '');
  const [hrs, setHrs] = useState(cur && cur.hrs ? cur.hrs : 1);
  const [full1, setFull1] = useState(cur && cur.full1 ? true : false);
  const [hkind, setHkind] = useState<'지각' | '외출' | '조퇴'>(cur && cur.hkind ? cur.hkind : '지각');
  const [tab, setTab] = useState<Tab>(tabOf(type));
  const lu = leaveUsage(state, parse(date)[0]);
  const pickTab = (v: Tab): void => { if (tabOf(type) !== v) setType(TAB_DEFAULT[v]); setTab(v); setErr(''); };
  const chip = (v: DraftType, label: string): React.ReactElement => <Chip key={v} label={label} on={type === v} onPress={() => { setType(v); setErr(''); }} />;
  const [err, setErr] = useState('');
  const three = isThree(state.pattern);
  const [mlabel, setMlabel] = useState<string>(state.manual[date] || '휴');
  const hn = holName(date);
  const dayEv = groupEvents(state)[date] || [];
  const dayMeets = allMeets(state).filter((m) => m.final === date);
  const dayMine = personalByDate(state.myEvents)[date] || [];
  const [evName, setEvName] = useState('');
  const [evDays, setEvDays] = useState(1);
  const [evTo, setEvTo] = useState('me');
  const [evOpen, setEvOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const targets: { code: string; name: string; myId: string }[] = [];
  if (state.cloud) targets.push({ code: state.cloud.code, name: state.cloud.name, myId: state.cloud.myId });
  (state.others || []).forEach((g) => targets.push({ code: g.code, name: g.name, myId: g.myId }));
  const addEvent = (): void => {
    const nm = evName.trim();
    if (!nm) { setErr('일정 이름을 입력하세요.'); return; }
    const days: string[] = [];
    for (let i = 0; i < evDays; i++) days.push(fromIdx(idx(date) + i));
    if (evTo === 'me') {
      update((s) => ({ ...s, myEvents: [...(s.myEvents || []), { id: newId(), name: nm, dates: days }] }));
    } else {
      const g = targets.find((x) => x.code === evTo);
      if (!g) return;
      const id = 'p' + g.myId + '.' + newId();
      const title = eventTitle('plain', nm);
      const poll = { id, title, dates: days, final: days[0], at: Date.now(), votes: {} };
      update((s) => {
        if (s.cloud && s.cloud.code === g.code) return { ...s, myPolls: [id, ...(s.myPolls || [])], polls: [poll, ...s.polls] };
        return { ...s, myPolls: [id, ...(s.myPolls || [])], others: (s.others || []).map((o) => (o.code === g.code ? { ...o, polls: [poll, ...o.polls] } : o)) };
      });
      markWrite();
      insertPoll(g.code, { id, title, dates: days })
        .then(() => { markWrite(); return updatePoll(g.code, id, { final: days[0] }); })
        .catch(() => reportErr('일정을 서버에 올리지 못했습니다.'));
    }
    setEvName(''); setEvDays(1); setEvOpen(false); setErr('');
  };
  const delMine = (id: string): void => {
    if (delId !== id) { setDelId(id); setTimeout(() => setDelId((c) => (c === id ? null : c)), 4000); return; }
    setDelId(null);
    update((s) => ({ ...s, myEvents: (s.myEvents || []).filter((x) => x.id !== id) }));
  };
  const sp = spouseOf(state);
  const spCare = sp ? mEff(sp, date).care : '';
  const spText = spCare === 'in' ? '출근 때' : spCare === 'out' ? '퇴근 때' : spCare === 'both' ? '출근·퇴근 모두' : '';
  const names = Array.from(new Set(Object.keys(state.ex).map((k) => state.ex[k]).filter((x) => x.type === 'swap' && x.who.trim()).map((x) => x.who.trim())));

  const save = (): void => {
    if (type === 'swap' && !who.trim()) { setErr('맞교대한 동료 이름을 입력하세요.'); return; }
    update((s) => {
      const ex = { ...s.ex };
      if (type === 'none') { if (memo.trim()) ex[date] = { type: 'memo', who: '', memo: memo.trim() }; else delete ex[date]; }
      else ex[date] = { type, who: type === 'swap' ? who.trim() : '', memo: memo.trim(), ...(type === 'hourly' ? { hrs, hkind } : {}), ...(type === 'leave' && full1 ? { full1: true } : {}) };
      const manual = { ...s.manual };
      if (s.pattern.t === 'manual') { if (mlabel === '휴') delete manual[date]; else manual[date] = mlabel; }
      return { ...s, ex, manual };
    });
    onClose();
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="닫기" />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: '80%', backgroundColor: t.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
          contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 34 }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700' }}>{p[1]}월 {p[2]}일({WD[wdOf(date)]})</Text>
            <Pill kind={e.base} text={three ? (e.base === 'duty' ? '당직일' : '비번일') : e.label} />
            {hn ? (
              <View style={{ backgroundColor: t.hol, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{hn}</Text>
              </View>
            ) : null}
          </View>
          {dayEv.length || dayMeets.length || spText || dayMine.length ? (
            <View style={{ gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: t.line }}>
              <Text style={{ color: t.ink2, fontSize: 12 }}>이 날 일정</Text>
              {dayMine.map((x) => (
                <Pressable key={x.id} onPress={() => delMine(x.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PERSONAL_COLOR }} />
                  <Text style={{ flex: 1, color: t.ink, fontSize: 14 }}>{x.name} <Text style={{ color: t.ink2, fontSize: 12 }}>(내 폰)</Text></Text>
                  <Text style={{ color: delId === x.id ? t.sun : t.ink2, fontSize: 12, fontWeight: delId === x.id ? '700' : '400' }}>{delId === x.id ? '한 번 더 눌러 삭제' : '삭제'}</Text>
                </Pressable>
              ))}
              {dayEv.map((x, i) => (
                <View key={'e' + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: x.color }} />
                  <Text style={{ flex: 1, color: t.ink, fontSize: 14 }}>{x.group ? x.group + ' · ' : ''}{x.name}</Text>
                </View>
              ))}
              {dayMeets.map((m) => (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: t.meet }} />
                  <Text style={{ flex: 1, color: t.ink, fontSize: 14 }}><Text style={{ fontWeight: '700', color: t.meet }}>모임 </Text>{m.group ? m.group + ' · ' : ''}{m.title}</Text>
                </View>
              ))}
              {spText ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#1E88E5' }} />
                  <Text style={{ flex: 1, color: t.ink, fontSize: 14 }}>{sp ? sp.name : '배우자'} 육아시간({spText})</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {three ? <Hint keep>이 날 당직은 {dutyTeam(state, date)}팀입니다. ({posOf(state.anchor, date) === 0 ? '내 당직일' : '내 비번 ' + posOf(state.anchor, date) + '일차'})</Hint> : null}
          {state.pattern.t === 'manual' ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: t.ink2, fontSize: 12 }}>이 날의 근무</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {WORK_LABELS.concat(OFF_LABELS).map((l) => <Chip key={l} label={l + (OFF_LABELS.indexOf(l) >= 0 ? ' (쉼)' : ' (근무)')} on={mlabel === l} onPress={() => setMlabel(l)} />)}
              </View>
            </View>
          ) : null}
          {evOpen ? (
            <View style={{ gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: t.line }}>
              <Text style={{ color: t.ink2, fontSize: 12 }}>일정 이름</Text>
              <TextInput
                value={evName} onChangeText={(v: string) => { setEvName(v); setErr(''); }} maxLength={20}
                style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink }}
                placeholderTextColor={t.ink2}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, color: t.ink, fontSize: 14 }}>며칠 동안: <Text style={{ fontWeight: '800' }}>{evDays}일</Text></Text>
                <Btn small ghost label="−" onPress={() => setEvDays(Math.max(1, evDays - 1))} style={{ minWidth: 40 }} />
                <Btn small ghost label="+" onPress={() => setEvDays(Math.min(14, evDays + 1))} style={{ minWidth: 40 }} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Chip label="내 폰에만" on={evTo === 'me'} onPress={() => setEvTo('me')} />
                {targets.map((g) => <Chip key={g.code} label={g.name + '에 올리기'} on={evTo === g.code} onPress={() => setEvTo(g.code)} />)}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn small label="일정 추가" onPress={addEvent} style={{ flex: 1 }} />
                <Btn small ghost label="취소" onPress={() => { setEvOpen(false); setErr(''); }} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <Btn small ghost label="+ 이 날 일정 추가" onPress={() => setEvOpen(true)} />
          )}
          <SegRow<Tab>
            options={TABS_A}
            value={tab}
            onChange={pickTab}
          />
          <View style={{ width: '80%' }}>
            <SegRow<Tab>
              options={TABS_B}
              value={tab}
              onChange={pickTab}
            />
          </View>
          {tab === 'base' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {chip('none', '기본 근무')}{chip('swap', '맞교대')}{chip('cover', '보강')}
            </View>
          ) : null}
          {tab === 'leave' ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {chip('leave', '전일')}{chip('halfAm', '반일 오전')}{chip('halfPm', '반일 오후')}
                {(['지각', '외출', '조퇴'] as const).map((k) => (
                  <Chip key={k} label={k} on={type === 'hourly' && hkind === k} onPress={() => { setType('hourly'); setHkind(k); setErr(''); }} />
                ))}
              </View>
              {type === 'leave' && lu.is24 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: t.ink2, fontSize: 12 }}>이 날 연가 계산</Text>
                  <Chip label="2일 (기본)" on={!full1} onPress={() => setFull1(false)} />
                  <Chip label="1일" on={full1} onPress={() => setFull1(true)} />
                </View>
              ) : null}
              {type === 'hourly' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flex: 1, color: t.ink, fontSize: 14 }}>쓴 시간: <Text style={{ fontWeight: '800' }}>{hrs}시간</Text></Text>
                  <Btn small ghost label="−" onPress={() => setHrs(Math.max(0.5, hrs - 0.5))} style={{ minWidth: 40 }} />
                  <Btn small ghost label="+" onPress={() => setHrs(Math.min(24, hrs + 0.5))} style={{ minWidth: 40 }} />
                </View>
              ) : null}
            </View>
          ) : null}
          {tab === 'sick' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {chip('sick', '진단서 없음')}{chip('sickCert', '진단서 첨부')}{chip('sickWork', '공무상병가')}
            </View>
          ) : null}
          {tab === 'special' ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {chip('condol', '경조사')}{chip('family', '가족돌봄')}
              </View>
              {type === 'family' ? (
                <Text style={{ color: t.ink, fontSize: 13, lineHeight: 19 }}>
                  <Text style={{ fontWeight: '800' }}>올해 가족돌봄 {lu.family + (cur && cur.type === 'family' ? 0 : 1)} / 10일</Text>
                  {' '}(유급·무급을 합쳐 연 10일까지, 이 날 포함){'\n'}
                  <Text style={{ color: t.ink2 }}>무급이 원칙이고, 자녀를 돌볼 때는 "자녀 수 + 1"일까지 유급으로 쓸 수 있습니다. 장애인 자녀를 돌보거나 한부모이면 유급 1일이 더해집니다.</Text>
                </Text>
              ) : null}
              <Text style={{ color: t.ink2, fontSize: 12 }}>근무 형태에 따라 쓰는 휴무 (당·비·비 근무자는 쓰지 않음)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {chip('dutyOff', '당직휴무')}{chip('subOff', '대체휴무')}{chip('turnOff', '순번휴무')}
              </View>
            </View>
          ) : null}
          {tab === 'official' ? <View style={{ flexDirection: 'row', gap: 6 }}>{chip('official', '공가')}</View> : null}
          {tab === 'care' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {chip('careIn', '출근 때')}{chip('careOut', '퇴근 때')}{chip('careBoth', '둘 다')}
            </View>
          ) : null}
          {tab === 'edu' ? <View style={{ flexDirection: 'row', gap: 6 }}>{chip('edu', '교육')}</View> : null}
          {tab === 'trip' ? <View style={{ flexDirection: 'row', gap: 6 }}>{chip('dispatch', '출장')}</View> : null}
          {tab === 'etc' ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {chip('etc', '기타')}{chip('tour', '관외여행')}{chip('fire', '소방(기타)')}{chip('absent', '결근')}
              </View>
              {type === 'absent' ? <Text style={{ color: t.ink2, fontSize: 12.5 }}>결근은 연가일수가 공제됩니다. (공제 일수는 전일연가와 같게 계산)</Text> : null}
            </View>
          ) : null}
          {isExtra(type) ? <Hint>이 날은 근무에서 빠지는 날로 표시됩니다. 같은 소모임 팀원에게는 "기타"로 보이고 연가계획표의 빠지는 인원에 들어갑니다.</Hint> : null}
          {type === 'dispatch' || type === 'etc' || type === 'edu' ? <Hint>이 날은 근무에서 빠지는 날로 표시됩니다. 같은 소모임 팀원의 "연가계획표"에서 빠지는 인원으로 계산됩니다.</Hint> : null}
          {type === 'cover' ? <Hint>쉬는 날 나와서 근무하는 보강근무입니다. 근무하는 날로 표시되고, 맞교대 장부에는 들어가지 않습니다.</Hint> : null}
          {type === 'careIn' || type === 'careOut' || type === 'careBoth' ? <Hint>근무는 그대로이고, 육아시간을 쓴 날로 표시됩니다. 같은 소모임에 들어 있는 배우자에게도 보입니다.</Hint> : null}
          {type === 'swap' ? (
            <View style={{ gap: 8 }}>
              <Hint>{e.base === 'duty' ? '동료가 내 근무를 대신 서고 나는 쉽니다. 내가 갚을 날이 1일 생깁니다.' : '내가 동료의 근무를 대신 섭니다. 동료에게 받을 날이 1일 생깁니다.'}</Hint>
              <Text style={{ color: t.ink2, fontSize: 12 }}>동료 이름</Text>
              <TextInput
                value={who} onChangeText={(v: string) => { setWho(v); setErr(''); }} maxLength={20}
                style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink }}
                placeholderTextColor={t.ink2}
              />
              {names.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {names.map((nm) => (
                    <Pressable key={nm} onPress={() => setWho(nm)} style={{ borderWidth: 1, borderColor: t.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: t.ink, fontSize: 12.5 }}>{nm}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={{ color: t.ink2, fontSize: 12 }}>메모(선택)</Text>
          <TextInput
            value={memo} onChangeText={setMemo} maxLength={40}
            style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink }}
            placeholderTextColor={t.ink2}
          />
          {err ? <Hint bad>{err}</Hint> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn label="저장" onPress={save} style={{ flex: 1 }} />
            <Btn label="닫기" ghost onPress={onClose} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
