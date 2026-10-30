import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Switch, Text, TextInput, View } from 'react-native';
import { WD, firstChar, fmt, fromIdx, idx, parse, wdOf } from '../lib/date';
import { LBL, Person, decPattern, isThree, mEff, mFree, manualFromEx, meetDays, roster, teamBase } from '../lib/shift';
import { downloadIcs, meetIcs } from '../lib/ics';
import { clearCodeFromUrl, codeFromUrl, inviteLink } from '../lib/link';
import { cloudConfigured, createTeam, deleteMember, deletePoll, fetchTeam, genCode, getTeam, insertPoll, normCode, updatePoll, upsertVote, validCode } from '../cloud';
import { AppState, CloudInfo, Poll } from '../types';
import MonthCalendar, { Deco } from '../MonthCalendar';
import CoupleCard from '../CoupleCard';
import { markWrite, newId, useStore } from '../store';
import { kindColors, useTheme } from '../theme';
import { Btn, Card, Chip, H2, Hint, Pill, SegRow } from '../ui';

export default function TeamScreen(): React.ReactElement {
  const { state } = useStore();
  const k = state.cloud ? state.cloud.code : 'local';
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <CloudCard />
      <RosterCard key={'r' + k} />
      <CoupleCard key={'c' + k} />
      <MeetCard key={'m' + k} />
      <PollsCard key={'p' + k} />
    </ScrollView>
  );
}

/* ---------- 소모임 (코드로 폰끼리 공유, 여러 개 가능) ---------- */
function CloudCard(): React.ReactElement | null {
  const t = useTheme();
  const { state, update, netErr, reportErr } = useStore();
  const urlCode = normCode(codeFromUrl());
  const alreadyIn = !!urlCode && ((state.cloud && state.cloud.code === urlCode) || (state.others || []).some((g) => g.code === urlCode));
  const [mode, setMode] = useState<'create' | 'join'>(urlCode && !alreadyIn ? 'join' : 'create');
  const [adding, setAdding] = useState(!!urlCode && !alreadyIn);
  const [name, setName] = useState('');
  const [nick, setNick] = useState(state.nick);
  const [code, setCode] = useState(urlCode && !alreadyIn ? urlCode : '');
  const [newCodeText, setNewCodeText] = useState(genCode());
  const [team, setTeam] = useState<number>(state.team);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState('');
  const [resumeId, setResumeId] = useState('');
  const curNick = (state.cloud && state.cloud.nick) || state.nick || '나';
  const [myNick, setMyNick] = useState(curNick);
  const [nickMsg, setNickMsg] = useState('');
  const curCode = state.cloud ? state.cloud.code : '';
  useEffect(() => { setMyNick(curNick); setNickMsg(''); }, [curCode, curNick]);
  if (!cloudConfigured()) return null;

  const renameMe = (): void => {
    const nk = myNick.trim();
    if (!nk || !state.cloud) return;
    if (state.members.some((m) => m.name === nk)) { setNickMsg('이 소모임에 같은 별명을 쓰는 사람이 있습니다. 다른 별명으로 바꿔 주세요.'); return; }
    update((s) => (s.cloud ? { ...s, cloud: { ...s.cloud, nick: nk } } : s));
    setNickMsg('별명을 "' + nk + '"(으)로 변경했습니다. 이 소모임에만 적용됩니다.');
  };

  const shareCode = async (msg: string): Promise<void> => {
    setNote('');
    const nav = (globalThis as unknown as { navigator?: { share?: (d: { text: string }) => Promise<void>; clipboard?: { writeText: (x: string) => Promise<void> } } }).navigator;
    try {
      if (nav && nav.share) { await nav.share({ text: msg }); return; }
    } catch (e) { /* 공유 창을 닫은 경우 등 */ }
    try {
      if (nav && nav.clipboard) { await nav.clipboard.writeText(msg); setNote('초대 문구가 복사됐습니다. 카카오톡에 붙여 넣으세요.'); return; }
    } catch (e) { /* 복사 권한 없음 */ }
    try { await Share.share({ message: msg }); } catch (e) { setNote('위의 코드를 길게 눌러 복사하세요.'); }
  };

  const others = state.others || [];
  const chips = (state.cloud ? [{ code: state.cloud.code, name: state.cloud.name }] : []).concat(others.map((g) => ({ code: g.code, name: g.name })));
  chips.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  /** 새 소모임을 지금 보는 소모임으로 만듭니다. 보던 소모임은 others로 보관합니다. */
  const enter = (s: AppState, info: CloudInfo): AppState => {
    const rest = (s.others || []).filter((g) => g.code !== info.code);
    if (s.cloud) rest.push({ ...s.cloud, members: s.members, polls: s.polls });
    return { ...s, cloud: info, members: [], polls: [], others: rest };
  };

  const switchTo = (c: string): void => {
    if (state.cloud && state.cloud.code === c) return;
    setArmed(false); setAdding(false);
    update((s) => {
      const g = (s.others || []).find((x) => x.code === c);
      if (!g || !s.cloud) return s;
      const rest = (s.others || []).filter((x) => x.code !== c);
      rest.push({ ...s.cloud, members: s.members, polls: s.polls });
      return { ...s, cloud: { code: g.code, name: g.name, myId: g.myId, nick: g.nick }, members: g.members, polls: g.polls, others: rest };
    });
  };

  const fail = (m: string): void => { setErr(m); setBusy(false); };
  const create = async (): Promise<void> => {
    const nm = name.trim();
    const nk = nick.trim();
    const cd = normCode(newCodeText);
    if (!nm || !nk) { fail('소모임 이름과 내 별명을 입력하세요.'); return; }
    if (!validCode(cd)) { fail('초대 코드는 한글·영문·숫자 2~12자로 만드세요. (띄어쓰기 없이)'); return; }
    if (!state.configured) { fail('먼저 설정 탭에서 내 팀과 오늘 상태를 고르고 완료를 누르세요.'); return; }
    setBusy(true); setErr('');
    try {
      if (await getTeam(cd)) { fail('이미 쓰는 코드입니다. 다른 코드로 바꿔 주세요.'); return; }
      await createTeam(cd, nm, teamBase(state));
      markWrite();
      update((s) => ({ ...enter(s, { code: cd, name: nm, myId: newId(), nick: nk }), nick: s.cloud ? s.nick : nk }));
      setName(''); setNewCodeText(genCode()); setAdding(false);
      setBusy(false);
    } catch (e) {
      fail('서버에 연결하지 못했습니다. 인터넷 연결과 접속 정보를 확인하세요.');
    }
  };

  const join = async (): Promise<void> => {
    const cd = normCode(code);
    const nk = nick.trim();
    if (!validCode(cd)) { fail('초대 코드를 확인하세요. (한글·영문·숫자 2~12자)'); return; }
    if (!nk) { fail('내 별명을 입력하세요.'); return; }
    if (chips.some((c) => c.code === cd)) { fail('이미 들어가 있는 소모임입니다.'); return; }
    setBusy(true); setErr('');
    try {
      const tm = await getTeam(cd);
      if (!tm) { fail('이 코드의 소모임을 찾을 수 없습니다. 코드를 다시 확인하세요.'); return; }
      const cur = await fetchTeam(cd, '');
      const same = cur.members.find((m) => m.name === nk);
      if (same && resumeId !== same.id) {
        setResumeId(same.id);
        fail('이 별명("' + nk + '")으로 이미 들어온 사람이 있습니다. 본인이라면 아래 "이어서 쓰기"를 누르세요. 다른 사람이면 별명을 바꿔 주세요.');
        return;
      }
      const mine = same ? same : null;
      markWrite();
      update((s) => {
        const ex = { ...s.ex };
        Object.keys(ex).forEach((k) => { if (ex[k].sample) delete ex[k]; });
        if (mine && !state.cloud) {
          // 서버에 남아 있는 내 연가·교육·맞교대(종류만)를 되살립니다.
          Object.keys(mine.ex).forEach((k) => {
            const ty = mine.ex[k];
            if (!ex[k] && (ty === 'leave' || ty === 'edu' || ty === 'swap' || ty === 'care')) ex[k] = { type: ty, who: '', memo: '' };
          });
        }
        const useTeam = mine ? mine.team : team;
        let base: AppState = s;
        if (!state.cloud) {
          base = { ...s, base3: tm.base };
          const dp = mine && mine.ex._p ? decPattern(mine.ex._p) : null;
          if (dp) base = { ...base, team: useTeam, pattern: dp.pat, anchor: dp.anchor, manual: manualFromEx(mine ? mine.ex : {}) };
          else if (isThree(s.pattern)) base = { ...base, team: useTeam, anchor: fromIdx(idx(tm.base) + (useTeam - 1)) };
        }
        return { ...enter({ ...base, ex, nick: s.cloud ? s.nick : nk, configured: true }, { code: tm.code, name: tm.name, myId: mine ? mine.id : newId(), nick: nk }) };
      });
      setCode(''); setAdding(false); setResumeId(''); clearCodeFromUrl();
      setBusy(false);
    } catch (e) {
      fail('서버에 연결하지 못했습니다. 인터넷 연결과 접속 정보를 확인하세요.');
    }
  };

  const leave = (): void => {
    if (!state.cloud) return;
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false);
    markWrite();
    deleteMember(state.cloud.code, state.cloud.myId).catch(() => undefined);
    update((s) => {
      const rest = s.others || [];
      if (!rest.length) return { ...s, cloud: null, members: [], polls: [], others: [] };
      const g = rest[0];
      return { ...s, cloud: { code: g.code, name: g.name, myId: g.myId, nick: g.nick }, members: g.members, polls: g.polls, others: rest.slice(1) };
    });
    reportErr('');
  };

  const field = { borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink } as const;

  const form = (
    <View style={{ gap: 10 }}>
      <SegRow<'create' | 'join'> options={[{ v: 'create', label: '소모임 만들기' }, { v: 'join', label: '코드로 들어가기' }]} value={mode} onChange={(v) => { setMode(v); setErr(''); }} />
      {mode === 'create' ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: t.ink2, fontSize: 12 }}>소모임 이름</Text>
          <TextInput value={name} onChangeText={(v: string) => setName(v)} maxLength={20} placeholderTextColor={t.ink2} style={field} />
          <Text style={{ color: t.ink2, fontSize: 12 }}>초대 코드 (한글 가능, 직접 바꿔도 됩니다)</Text>
          <TextInput value={newCodeText} onChangeText={(v: string) => setNewCodeText(v)} maxLength={12} autoCapitalize="none" placeholderTextColor={t.ink2} style={field} />
          <Btn small ghost label="다른 코드 추천받기" onPress={() => setNewCodeText(genCode())} />
          <View style={{ gap: 8 }}>
            <Text style={{ color: t.ink2, fontSize: 12 }}>{state.cloud ? '이 소모임에서 쓸 내 별명' : '내 별명'}</Text>
            <TextInput value={nick} onChangeText={(v: string) => setNick(v)} maxLength={12} placeholderTextColor={t.ink2} style={field} />
          </View>
          <Hint>내 근무 기준: {state.configured ? state.team + '팀 (설정 탭에서 바꿀 수 있음)' : '설정 탭에서 내 팀과 오늘 상태를 먼저 고르세요.'}</Hint>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={{ color: t.ink2, fontSize: 12 }}>초대 코드</Text>
          <TextInput value={code} onChangeText={(v: string) => { setCode(v); setResumeId(''); }} maxLength={12} autoCapitalize="none" placeholderTextColor={t.ink2} style={field} />
          <View style={{ gap: 8 }}>
            <Text style={{ color: t.ink2, fontSize: 12 }}>{state.cloud ? '이 소모임에서 쓸 내 별명' : '내 별명'}</Text>
            <TextInput value={nick} onChangeText={(v: string) => { setNick(v); setResumeId(''); }} maxLength={12} placeholderTextColor={t.ink2} style={field} />
            {state.cloud ? null : (
              <View style={{ gap: 8 }}>
                <Text style={{ color: t.ink2, fontSize: 12 }}>내 팀</Text>
                <SegRow<number> options={[{ v: 1, label: '1팀' }, { v: 2, label: '2팀' }, { v: 3, label: '3팀' }]} value={team} onChange={setTeam} />
              </View>
            )}
          </View>
        </View>
      )}
      {err ? <Hint bad>{err}</Hint> : null}
      <Btn label={busy ? '처리 중...' : mode === 'create' ? '소모임 만들기' : resumeId ? '이어서 쓰기' : '들어가기'} disabled={busy} onPress={() => { if (mode === 'create') create(); else join(); }} />
    </View>
  );

  if (!state.cloud) {
    return (
      <Card style={{ gap: 10 }}>
        <H2>소모임 (폰끼리 연결)</H2>
        <Hint>소모임을 만들면 초대 코드가 생깁니다. 같은 코드로 들어온 사람들의 근무와 모임 투표가 서로의 폰에 보입니다. 소모임은 여러 개 만들거나 들어갈 수 있습니다. 아래의 "우리 팀" 수동 입력은 혼자 써 볼 때만 쓰세요.</Hint>
        {form}
      </Card>
    );
  }

  const c = state.cloud;
  return (
    <Card style={{ gap: 10 }}>
      <H2>내 소모임</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {chips.map((g) => <Chip key={g.code} label={g.name} on={!adding && g.code === c.code} onPress={() => switchTo(g.code)} />)}
        <Chip label="＋ 추가" on={adding} onPress={() => { setAdding(!adding); setErr(''); }} />
      </View>
      {adding ? form : (
        <View style={{ gap: 8 }}>
          <Text style={{ color: t.ink2, fontSize: 12 }}>{c.name} · 초대 코드</Text>
          <Text selectable style={{ color: t.ink, fontSize: 26, fontWeight: '700', letterSpacing: 1 }}>{c.code}</Text>
          <Hint>이 코드를 동료에게 알려 주세요. 코드로 들어와 별명과 팀만 입력하면 됩니다. 아래의 멤버·쉬는 날·투표는 지금 고른 소모임 기준입니다.</Hint>
          <Text style={{ color: t.ink2, fontSize: 12 }}>이 소모임에서 쓰는 내 별명</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={myNick} onChangeText={(v: string) => { setMyNick(v); setNickMsg(''); }} maxLength={12} placeholderTextColor={t.ink2} style={[field, { flex: 1 }]} />
            <Btn small label="변경" disabled={!myNick.trim() || myNick.trim() === curNick} onPress={renameMe} />
          </View>
          {nickMsg ? <Hint bad={nickMsg.indexOf('변경했') < 0}>{nickMsg}</Hint> : null}
          {netErr ? <Hint bad>{netErr}</Hint> : null}
          {note ? <Hint>{note}</Hint> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn small label="코드 공유" onPress={() => { const lk = inviteLink(c.code); shareCode('소방 교대달력 소모임 [' + c.name + '] 초대' + (lk ? '\n링크: ' + lk : '') + '\n초대 코드: ' + c.code); }} />
            <Btn small ghost label={armed ? '한 번 더 눌러 나가기' : '이 소모임에서 나가기'} onPress={leave} />
          </View>
        </View>
      )}
    </Card>
  );
}

/* ---------- 우리 팀 ---------- */
function RosterCard(): React.ReactElement {
  const t = useTheme();
  const { state, update, today } = useStore();
  const ms = roster(state);
  const [name, setName] = useState('');
  const [team, setTeam] = useState<number>(1);
  const [delArm, setDelArm] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const onDuty = ms.filter((m) => mEff(m, today).works).map((m) => m.name);
  const online = !!state.cloud;

  const add = (): void => {
    const nm = name.trim();
    if (!nm) { setErr('이름을 입력하세요.'); return; }
    if (ms.some((m) => m.name === nm)) { setErr('같은 이름이 이미 있습니다.'); return; }
    update((s) => ({ ...s, members: [...s.members, { id: newId(), name: nm, team, ex: {} }] }));
    setName(''); setErr('');
  };

  const remove = (id: string): void => {
    if (delArm !== id) { setDelArm(id); setTimeout(() => setDelArm((cur) => (cur === id ? null : cur)), 4000); return; }
    setDelArm(null);
    update((s) => ({ ...s, members: s.members.filter((m) => m.id !== id) }));
  };

  const cycle = (id: string, d: string): void => {
    update((s) => ({
      ...s,
      members: s.members.map((m) => {
        if (m.id !== id) return m;
        const ex = { ...m.ex };
        const cur = ex[d];
        if (!cur) ex[d] = 'leave'; else if (cur === 'leave') ex[d] = 'edu'; else delete ex[d];
        return { ...m, ex };
      }),
    }));
  };

  return (
    <Card style={{ gap: 10 }}>
      <H2>우리 팀</H2>
      <Hint>{online ? '팀에 들어온 동료들의 오늘부터 7일 근무입니다. 각자 자기 폰에서 입력한 연가·교육이 반영됩니다.' : '같은 근무조 동료를 이름과 팀 번호로 추가하면 그 사람의 당직·비번이 자동으로 계산됩니다. 막대의 칸을 누르면 그 사람의 연가, 교육을 표시할 수 있습니다. 오늘부터 7일입니다.'}</Hint>
      <Text style={{ color: t.ink, fontSize: 13 }}>오늘 근무: <Text style={{ fontWeight: '700' }}>{onDuty.length ? onDuty.join(', ') : '없음'}</Text></Text>
      {ms.map((m) => <MemberRow key={m.id} p={m} today={today} onCycle={cycle} onRemove={remove} armed={delArm === m.id} readOnly={online} />)}
      {online ? null : <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.line }}>
        <Text style={{ color: t.ink2, fontSize: 12 }}>팀원 추가</Text>
        <TextInput
          value={name} onChangeText={(v: string) => { setName(v); setErr(''); }} maxLength={12} placeholder="이름"
          placeholderTextColor={t.ink2}
          style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink }}
        />
        <SegRow<number> options={[{ v: 1, label: '1팀' }, { v: 2, label: '2팀' }, { v: 3, label: '3팀' }]} value={team} onChange={setTeam} />
        {err ? <Hint bad>{err}</Hint> : null}
        <Btn label="추가" onPress={add} />
      </View>}
    </Card>
  );
}

function MemberRow(props: { p: Person; today: string; onCycle: (id: string, d: string) => void; onRemove: (id: string) => void; armed: boolean; readOnly: boolean }): React.ReactElement {
  const t = useTheme();
  const { p, today, onCycle, onRemove, armed, readOnly } = props;
  const e = mEff(p, today);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(fromIdx(idx(today) + i));
  return (
    <View style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: t.ink, fontWeight: '700' }}>
          {p.name}
          {p.isMe ? <Text style={{ color: t.ink2, fontSize: 12, fontWeight: '400' }}>  나</Text> : null}
          <Text style={{ color: t.ink2, fontSize: 12, fontWeight: '400' }}>  {isThree(p.pat) ? p.team + '팀' : p.pat.n}</Text>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pill kind={e.kind} text={e.kind === 'duty' || e.kind === 'off' ? e.label : LBL[e.kind]} />
          {!p.isMe && !readOnly ? (
            <Pressable onPress={() => onRemove(p.id)} accessibilityRole="button">
              <Text style={{ color: armed ? t.bad : t.ink2, fontSize: 12.5 }}>{armed ? '한 번 더 눌러 삭제' : '삭제'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {days.map((d) => {
          const x = mEff(p, d);
          const c = kindColors(t, x.kind);
          const dd = parse(d);
          return (
            <Pressable
              key={d}
              disabled={p.isMe || readOnly}
              onPress={() => onCycle(p.id, d)}
              accessibilityLabel={dd[1] + '월 ' + dd[2] + '일 ' + (x.kind === 'duty' || x.kind === 'off' ? x.label : LBL[x.kind])}
              style={{ flex: 1, alignItems: 'center', gap: 2 }}
            >
              <View style={{ width: '100%', height: 22, borderRadius: 5, backgroundColor: x.kind === 'duty' ? t.duty : c.bg, borderWidth: 1, borderColor: c.fg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: x.kind === 'duty' ? t.onDuty : c.fg }}>{x.kind === 'duty' || x.kind === 'off' ? x.l : LBL[x.kind].slice(0, 1)}</Text>
              </View>
              <Text style={{ color: t.ink2, fontSize: 10.5 }}>{dd[2]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ---------- 모임 일정 잡기 ---------- */
function MeetCard(): React.ReactElement {
  const t = useTheme();
  const { state, update, today, reportErr } = useStore();
  const [title, setTitle] = useState('모임');
  const [range, setRange] = useState<number>(30);
  const [skipPost, setSkipPost] = useState(false);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const ms = roster(state);
  const r = meetDays(state, off, range, skipPost, today);
  const valid = (d: string): boolean => idx(d) > idx(today);
  const busyOf = (d: string): Person[] => r.ms.filter((m) => !mFree(m, d, skipPost));
  const picks = Object.keys(pick).filter(valid).sort();

  /** 아직 확정되지 않은 가장 최근 투표. 있으면 달력에 그 투표의 날짜가 먼저 체크되어 있고, 고쳐서 그대로 수정합니다. */
  const openPoll = state.polls
    .filter((p) => !p.final && (p.dates.slice().sort().pop() || '') >= today)
    .sort((a, b) => b.at - a.at)[0];
  const openId = openPoll ? openPoll.id : '';
  const [syncedFor, setSyncedFor] = useState('');
  const finalIds = state.polls.filter((p) => p.final).map((p) => p.id);
  const doneRef = React.useRef<Record<string, boolean>>(Object.fromEntries(finalIds.map((id) => [id, true])));
  useEffect(() => {
    let fresh = false;
    finalIds.forEach((id) => { if (!doneRef.current[id]) { doneRef.current[id] = true; fresh = true; } });
    if (fresh) { setPick({}); setSyncedFor(openId); }
  }, [finalIds.join(',')]);
  useEffect(() => {
    if (openPoll && doneRef.current[openPoll.id]) {
      setSyncedFor(openPoll.id);
    } else if (openPoll && syncedFor !== openPoll.id) {
      const n: Record<string, boolean> = {};
      openPoll.dates.forEach((d) => { n[d] = true; });
      setPick(n);
      setTitle(openPoll.title);
      setSyncedFor(openPoll.id);
    } else if (!openPoll && syncedFor) {
      setPick({});
      setSyncedFor('');
    }
  }, [openId]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, k: string): void => {
    setter((prev) => { const n = { ...prev }; if (n[k]) delete n[k]; else n[k] = true; return n; });
  };

  const make = (): void => {
    if (!picks.length) return;
    const dates = picks.slice();
    const id = (state.cloud ? 'p' + state.cloud.myId + '.' : '') + newId();
    const pollTitle = title.trim() || '모임';
    update((s) => ({ ...s, myPolls: [id, ...(s.myPolls || [])], polls: [{ id, title: pollTitle, dates, final: '', at: Date.now(), votes: {} }, ...s.polls] }));
    if (state.cloud) {
      const c = state.cloud;
      markWrite();
      insertPoll(c.code, { id, title: pollTitle, dates })
        .catch(() => reportErr('투표를 서버에 올리지 못했습니다.'));
    }
  };

  const editOpen = (): void => {
    if (!openPoll || !picks.length) return;
    const pid = openPoll.id;
    const dates = picks.slice();
    const pollTitle = title.trim() || openPoll.title;
    update((s) => ({ ...s, polls: s.polls.map((p) => (p.id === pid ? { ...p, dates, title: pollTitle } : p)) }));
    if (state.cloud) {
      markWrite();
      updatePoll(state.cloud.code, pid, { dates, title: pollTitle }).catch(() => reportErr('투표를 서버에 저장하지 못했습니다.'));
    }
  };

  const decorate = (d: string): Deco | null => {
    if (!valid(d) || r.ms.length < 2) return null;
    const busy = busyOf(d);
    const tag = busy.length === 0 ? '전원' : busy.length === 1 ? '−' + firstChar(busy[0].name) : '−' + busy.length + '명';
    if (pick[d]) return { solid: t.leave, tag };
    const tone = busy.length === 0 ? kindColors(t, 'leave').fg : busy.length === 1 ? kindColors(t, 'swap').fg : t.ink2;
    return { tag, tagColor: tone };
  };

  return (
    <Card style={{ gap: 10 }}>
      <H2>모임 일정 잡기</H2>
      <Hint>참석할 사람을 고르면 모두 쉬는 날이 나옵니다. 후보 날짜를 탭해서 고르고 투표를 올리세요. 당직과 교육은 불가, 비번과 연가는 가능으로 계산합니다.</Hint>
      <Text style={{ color: t.ink2, fontSize: 12 }}>모임 이름</Text>
      <TextInput
        value={title} onChangeText={setTitle} maxLength={20} placeholderTextColor={t.ink2}
        style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink }}
      />
      <Text style={{ color: t.ink2, fontSize: 12 }}>찾을 기간 (내일부터)</Text>
      <SegRow<number> options={[{ v: 14, label: '14일' }, { v: 30, label: '30일' }, { v: 60, label: '60일' }]} value={range} onChange={setRange} />
      <Text style={{ color: t.ink2, fontSize: 12 }}>참석할 사람</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {ms.map((m) => <Chip key={m.id} label={m.name} on={!off[m.id]} onPress={() => toggle(setOff, m.id)} />)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: t.ink, fontSize: 13.5, flex: 1 }}>근무 다음날(비번·휴무 첫날)은 제외</Text>
        <Switch value={skipPost} onValueChange={setSkipPost} />
      </View>

      {r.ms.length < 2 ? <Hint>참석할 사람을 두 명 이상 고르세요.</Hint> : (
        <View style={{ gap: 8 }}>
          <Text style={{ color: t.ink, fontSize: 13 }}>
            <Text style={{ fontWeight: '700' }}>전원이 쉬는 날 {r.full.length}일</Text>{r.full.length ? '' : ' · 인원을 줄이거나 기간을 늘려 보세요.'}
          </Text>
          <MonthCalendar bare decorate={decorate} onPressDate={(d) => { if (valid(d)) toggle(setPick, d); }} />
          <Hint>내일부터의 날짜를 탭하면 초록색 체크 칸으로 바뀝니다. 날짜 아래 글자: "전원"은 모두 쉬는 날, "−김"은 그 사람만 빠지는 날, "−3명"은 3명이 빠지는 날입니다.</Hint>
          <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.line }}>
            <Hint>{picks.length}일 선택{picks.length ? ' · ' + picks.map((d) => { const p = parse(d); return p[1] + '/' + p[2] + '(' + WD[wdOf(d)] + ')'; }).join(', ') : ' · 날짜를 탭해서 후보를 고르세요.'}</Hint>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn small ghost label="전원 가능한 날 모두 선택" disabled={!r.full.length} onPress={() => setPick((prev) => { const n = { ...prev }; r.full.forEach((c) => { n[c.iso] = true; }); return n; })} />
              {openPoll ? null : <Btn small label="투표 올리기" disabled={!picks.length} onPress={make} />}
            </View>
            {openPoll ? (
              <View style={{ gap: 8 }}>
                <Hint>올라가 있는 투표 "{openPoll.title}"의 날짜가 먼저 체크되어 있습니다. 날짜를 더 누르거나 눌러서 빼고 수정하면 같은 투표가 바뀌고, 이미 눌린 표는 유지됩니다.</Hint>
                <Btn label="이 투표 수정하기" disabled={!picks.length} onPress={editOpen} />
                <Btn small ghost label="새 투표로 따로 올리기" disabled={!picks.length} onPress={make} />
              </View>
            ) : null}
          </View>
        </View>
      )}
    </Card>
  );
}

/* ---------- 모임 투표 ---------- */
function PollsCard(): React.ReactElement {
  const t = useTheme();
  const { state, today, netErr, syncedAt } = useStore();
  const live = state.polls
    .filter((p) => (p.final || p.dates.slice().sort().pop() || '') >= today)
    .sort((a, b) => b.at - a.at);
  return (
    <Card style={{ gap: 12 }}>
      <H2>모임 투표</H2>
      {state.cloud ? <Hint bad={!!netErr}>{netErr || (syncedAt ? '서버와 연결됨 · 마지막 갱신 ' + new Date(syncedAt).toTimeString().slice(0, 8) : '서버에 연결하는 중...')}</Hint> : null}
      {live.length === 0 ? <Hint>위에서 후보 날짜를 탭해 투표를 올리면 여기에 나타납니다. 이 테스트판에서는 투표하는 사람을 직접 골라 대신 눌러 볼 수 있습니다.</Hint> : null}
      {live.map((p) => <PollView key={p.id} pid={p.id} />)}
      <Text style={{ color: t.ink2, fontSize: 12 }}>지난 날짜의 투표는 자동으로 숨겨집니다.</Text>
    </Card>
  );
}

function PollView({ pid }: { pid: string }): React.ReactElement | null {
  const t = useTheme();
  const { state, update, reportErr } = useStore();
  const poll = state.polls.find((x) => x.id === pid);
  const ms = roster(state);
  const [voter, setVoter] = useState<string>('me');
  const [armed, setArmed] = useState(false);
  if (!poll) return null;

  const dates = poll.dates.slice().sort();
  const total = ms.length;
  const counts: Record<string, number> = {};
  const voters: Record<string, Person[]> = {};
  dates.forEach((d) => { counts[d] = 0; voters[d] = []; });
  let voted = 0;
  ms.forEach((m) => {
    const arr = poll.votes[m.id] || [];
    if (arr.length) voted++;
    arr.forEach((d) => { if (counts[d] != null) { counts[d]++; voters[d].push(m); } });
  });
  let max = 0;
  dates.forEach((d) => { if (counts[d] > max) max = counts[d]; });
  const online = !!state.cloud;
  const canFinalize = !online || (state.myPolls || []).indexOf(pid) >= 0 || (state.cloud ? pid.indexOf('p' + state.cloud.myId + '.') === 0 : false);
  const cur = (online ? ms[0] : ms.find((m) => m.id === voter)) || ms[0];
  const mineArr = poll.votes[cur.id] || [];

  const patch = (fn: (p: Poll) => Poll): void => {
    update((s) => ({ ...s, polls: s.polls.map((x) => (x.id === pid ? fn(x) : x)) }));
  };
  const pushVote = (arr: string[]): void => {
    if (!state.cloud || cur.id !== 'me') return;
    markWrite();
    upsertVote(state.cloud.code, pid, state.cloud.myId, arr).catch(() => reportErr('투표를 서버에 올리지 못했습니다.'));
  };
  const setFinal = (f: string): void => {
    patch((p) => ({ ...p, final: f }));
    if (state.cloud) { markWrite(); updatePoll(state.cloud.code, pid, { final: f }).catch(() => reportErr('서버에 저장하지 못했습니다.')); }
  };
  const toggleVote = (d: string): void => {
    const arr = (poll.votes[cur.id] || []).slice();
    const i = arr.indexOf(d);
    if (i >= 0) arr.splice(i, 1); else arr.push(d);
    patch((p) => ({ ...p, votes: { ...p.votes, [cur.id]: arr } }));
    pushVote(arr);
  };
  const allFree = (): void => {
    const arr = (poll.votes[cur.id] || []).slice();
    dates.forEach((d) => { if (mFree(cur, d, false) && arr.indexOf(d) < 0) arr.push(d); });
    patch((p) => ({ ...p, votes: { ...p.votes, [cur.id]: arr } }));
    pushVote(arr);
  };
  const del = (): void => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    update((s) => ({ ...s, polls: s.polls.filter((x) => x.id !== pid) }));
    if (state.cloud) { markWrite(); deletePoll(state.cloud.code, pid).catch(() => reportErr('서버에서 지우지 못했습니다.')); }
  };
  const nm = (m: Person): string => m.name;

  if (poll.final) {
    const fv = voters[poll.final] || [];
    const rest = ms.filter((m) => fv.indexOf(m) < 0);
    const hard = ms.filter((m) => !mFree(m, poll.final, false));
    return (
      <View style={{ gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.line }}>
        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 15 }}>{poll.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pill kind="leave" text="확정" />
          <Text style={{ color: t.ink, fontWeight: '700' }}>{fmt(poll.final)}</Text>
        </View>
        <Hint>가능 표시 {fv.length}명{fv.length ? ' (' + fv.map(nm).join(', ') + ')' : ''}{rest.length ? ' · 표시 안 함 ' + rest.map(nm).join(', ') : ''}</Hint>
        {hard.length ? <Hint bad>근무 일정상 어려운 사람: {hard.map(nm).join(', ')}</Hint> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Platform.OS === 'web' ? <Btn small label="내 캘린더에 알림과 함께 추가" onPress={() => { downloadIcs('모임-' + poll.final + '.ics', meetIcs(poll.id, poll.title, state.cloud ? state.cloud.name : '', poll.final)); }} /> : null}
          <Btn small ghost label="다시 열기" onPress={() => setFinal('')} />
          <Btn small ghost label={armed ? '한 번 더 눌러 삭제' : '투표 삭제'} onPress={del} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.line }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 15 }}>{poll.title}</Text>
        <Text style={{ color: t.ink2, fontSize: 12.5 }}>응답 {voted}/{total}명</Text>
      </View>
      {online ? null : <Text style={{ color: t.ink2, fontSize: 12 }}>투표하는 사람</Text>}
      {online ? null : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {ms.map((m) => <Chip key={m.id} label={m.name} on={cur.id === m.id} onPress={() => setVoter(m.id)} />)}
        </View>
      )}
      {dates.map((d) => {
        const c = counts[d];
        const on = mineArr.indexOf(d) >= 0;
        const pct = total ? Math.round((c / total) * 100) : 0;
        const top = voted >= total && max > 0 && c === max;
        const p2 = parse(d);
        const free = mFree(cur, d, false);
        return (
          <View key={d} style={{ gap: 6, padding: 8, borderWidth: top ? 2 : 1, borderRadius: 8, borderColor: top ? t.leave : t.line }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => toggleVote(d)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderWidth: 1, borderRadius: 8, borderColor: top || on ? t.leave : t.line, backgroundColor: top ? t.leave : on ? t.leaveSoft : t.surface }}
            >
              <Text style={{ width: 62, color: top ? '#FFFFFF' : on ? t.leave : t.ink, fontSize: 16, fontWeight: '600' }}>{p2[1]}/{p2[2]}<Text style={{ fontSize: 12, fontWeight: '400' }}> ({WD[wdOf(d)]})</Text></Text>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: top ? 'rgba(255,255,255,0.35)' : t.offSoft, overflow: 'hidden' }}>
                <View style={{ width: (pct + '%') as `${number}%`, height: 8, backgroundColor: top ? '#FFFFFF' : t.leave }} />
              </View>
              <Text style={{ width: 34, textAlign: 'right', color: top ? '#FFFFFF' : t.ink, fontSize: 12.5, fontWeight: top ? '700' : '400' }}>{c}/{total}</Text>
              <Text style={{ width: 50, color: top ? '#FFFFFF' : t.leave, fontSize: 12, fontWeight: '700' }}>{on ? '✓ 가능' : ''}</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {voters[d].map((m) => (
                <View key={m.id} style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: t.leave, backgroundColor: t.leaveSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: t.leave, fontSize: 11, fontWeight: '700' }}>{firstChar(m.name)}</Text>
                </View>
              ))}
              {c > 0 && c === total ? <Pill kind="leave" text="전원 가능" /> : top && dates.length > 1 ? <Pill kind="swap" text="가장 많음" /> : null}
              {!free ? <Text style={{ color: t.bad, fontSize: 12 }}>{cur.name} 근무상 어려움</Text> : null}
            </View>
          </View>
        );
      })}
      {voted < total ? (
        <Hint>전원이 투표하면 모임을 확정할 수 있습니다. (현재 {voted}/{total}명 응답)</Hint>
      ) : canFinalize ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: '700' }}>전원 투표 완료 · 확정할 날짜를 고르세요</Text>
          {dates.filter((d) => counts[d] === max).map((d) => {
            const p3 = parse(d);
            return <Btn key={d} label={'모임 확정 · ' + p3[1] + '/' + p3[2] + '(' + WD[wdOf(d)] + ') ' + counts[d] + '/' + total + '명'} onPress={() => setFinal(d)} />;
          })}
          {dates.some((d) => counts[d] !== max) ? <Hint>가장 많이 선택된 날짜만 확정할 수 있습니다.</Hint> : null}
        </View>
      ) : (
        <Hint>전원 투표 완료 · 투표를 올린 사람이 확정하면 모두의 달력에 표시됩니다.</Hint>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn small ghost label={cur.name + ' 쉬는 날 모두 체크'} onPress={allFree} />
        <Btn small ghost label={armed ? '한 번 더 눌러 삭제' : '투표 삭제'} onPress={del} />
      </View>
    </View>
  );
}
