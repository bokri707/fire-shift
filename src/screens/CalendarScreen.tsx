import React, { useState } from 'react';
import {
  KeyboardAvoidingView, LayoutChangeEvent, Modal, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { WD, fmt, idx, parse, wdOf } from '../lib/date';
import { downloadIcs, dutyIcs } from '../lib/ics';
import { holName } from '../lib/holidays';
import { LBL, OFF_LABELS, WORK_LABELS, allMeets, dutyTeam, eff, hasManyGroups, isThree, ledger, nextDuty, posOf } from '../lib/shift';
import MonthCalendar from '../MonthCalendar';
import SetupCard from '../SetupCard';
import { useStore } from '../store';
import { kindColors, useTheme } from '../theme';
import { Btn, Card, Chip, H2, Hint, Pill, SegRow } from '../ui';

export default function CalendarScreen(): React.ReactElement {
  const t = useTheme();
  const { state, today } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | undefined>(undefined);
  const [showSetup, setShowSetup] = useState(false);

  const te = eff(state, today);
  const tp = parse(today);
  const nd = nextDuty(state, today);
  const th = holName(today);
  const tc = kindColors(t, te.kind);

  const rows = ledger(state);
  const meets = allMeets(state).filter((p) => p.final >= today).sort((a, b) => (a.final < b.final ? -1 : 1));
  const many = hasManyGroups(state);
  const soon = meets.filter((m) => idx(m.final) - idx(today) <= 1);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {!state.configured || showSetup ? <SetupCard onDone={() => setShowSetup(false)} /> : null}
      {soon.length ? (
        <Card style={{ gap: 4, borderWidth: 2, borderColor: t.meet }}>
          {soon.map((m) => (
            <Text key={m.id} style={{ color: t.meet, fontSize: 16, fontWeight: '700' }}>
              {idx(m.final) === idx(today) ? '오늘' : '내일'} 모임 · {many ? m.group + ' · ' : ''}{m.title}
            </Text>
          ))}
        </Card>
      ) : null}
      <Card style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700' }}>오늘 {tp[1]}월 {tp[2]}일 {WD[wdOf(today)]}요일</Text>
          {th ? (
            <View style={{ backgroundColor: t.hol, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>공휴일 · {th}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: tc.fg, fontSize: 56, fontWeight: '700', lineHeight: 66 }}>
          {te.label}
          {te.sub ? <Text style={{ fontSize: 14, fontWeight: '500' }}>  {te.sub}</Text> : null}
        </Text>
        <Text style={{ color: t.ink, fontSize: 14 }}>
          {nd ? (isThree(state.pattern) ? '다음 당직 ' : '다음 근무 ') + fmt(nd.iso) + ' · ' + (nd.days === 1 ? '내일' : nd.days + '일 뒤') : '앞으로 120일 안에 예정된 근무가 없습니다.'}
        </Text>
        {meets.map((m) => {
          const dd = idx(m.final) - idx(today);
          return (
            <Text key={m.id} style={{ color: t.meet, fontSize: 14, fontWeight: '700' }}>
              모임 {fmt(m.final)} · {many ? m.group + ' · ' : ''}{m.title} · {dd === 0 ? '오늘' : dd + '일 뒤'}
            </Text>
          );
        })}
        <Pressable onPress={() => setShowSetup((v) => !v)} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
          <Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>{isThree(state.pattern) ? '내 팀 ' + state.team + '팀' : state.pattern.n} · 설정 {showSetup ? '닫기' : '바꾸기'}</Text>
        </Pressable>
      </Card>

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

      {Platform.OS === 'web' ? (
        <Card style={{ gap: 10 }}>
          <H2>근무 알림</H2>
          <Hint>앞으로 60일 중 내 근무일을 폰 캘린더에 넣고, 근무 전날 저녁 9시에 알려줍니다. 근무표나 맞교대를 바꾸면 다시 받아서 열어 주세요.</Hint>
          <Btn small label="내 캘린더에 근무 알림 추가" onPress={() => { downloadIcs('근무알림.ics', dutyIcs(state, today, 60)); }} />
        </Card>
      ) : null}

      {state.teamOn !== true && !state.cloud ? (
        <Hint>동료와 근무를 공유하거나 모임 투표를 하려면 설정 탭의 "기능 켜기"에서 팀·모임을 켜세요.</Hint>
      ) : null}

      <Text style={{ color: t.ink2, fontSize: 12, lineHeight: 18 }}>
        기록은 이 폰 안에만 저장됩니다. 기관 근무 규정과 다를 수 있으니 실제 근무표와 함께 확인하세요.
      </Text>

      {sel ? <EditorModal key={sel} date={sel} onClose={() => setSel(null)} /> : null}
    </ScrollView>
  );
}

type DraftType = 'none' | 'leave' | 'edu' | 'dispatch' | 'etc' | 'swap' | 'careIn' | 'careOut' | 'careBoth';

function EditorModal({ date, onClose }: { date: string; onClose: () => void }): React.ReactElement {
  const t = useTheme();
  const { state, update } = useStore();
  const e = eff(state, date);
  const p = parse(date);
  const cur = state.ex[date];
  const [type, setType] = useState<DraftType>(cur ? (cur.type === 'care' ? 'careOut' : cur.type) : 'none');
  const [who, setWho] = useState(cur ? cur.who : '');
  const [memo, setMemo] = useState(cur ? cur.memo : '');
  const [err, setErr] = useState('');
  const three = isThree(state.pattern);
  const [mlabel, setMlabel] = useState<string>(state.manual[date] || '휴');
  const hn = holName(date);
  const names = Array.from(new Set(Object.keys(state.ex).map((k) => state.ex[k]).filter((x) => x.type === 'swap' && x.who.trim()).map((x) => x.who.trim())));

  const save = (): void => {
    if (type === 'swap' && !who.trim()) { setErr('맞교대한 동료 이름을 입력하세요.'); return; }
    update((s) => {
      const ex = { ...s.ex };
      if (type === 'none') delete ex[date];
      else ex[date] = { type, who: type === 'swap' ? who.trim() : '', memo: memo.trim() };
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
          {three ? <Hint>이 날 당직은 {dutyTeam(state, date)}팀입니다. ({posOf(state.anchor, date) === 0 ? '내 당직일' : '내 비번 ' + posOf(state.anchor, date) + '일차'})</Hint> : null}
          {state.pattern.t === 'manual' ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: t.ink2, fontSize: 12 }}>이 날의 근무</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {WORK_LABELS.concat(OFF_LABELS).map((l) => <Chip key={l} label={l + (OFF_LABELS.indexOf(l) >= 0 ? ' (쉼)' : ' (근무)')} on={mlabel === l} onPress={() => setMlabel(l)} />)}
              </View>
            </View>
          ) : null}
          <SegRow<DraftType>
            options={[{ v: 'none', label: '기본' }, { v: 'leave', label: '연가' }, { v: 'edu', label: '교육' }, { v: 'dispatch', label: '파견' }, { v: 'etc', label: '기타' }]}
            value={type}
            onChange={(v) => { setType(v); setErr(''); }}
          />
          <SegRow<DraftType>
            options={[{ v: 'swap', label: '맞교대' }, { v: 'careIn', label: '육아(출근)' }, { v: 'careOut', label: '육아(퇴근)' }, { v: 'careBoth', label: '육아(둘 다)' }]}
            value={type}
            onChange={(v) => { setType(v); setErr(''); }}
          />
          {type === 'dispatch' || type === 'etc' ? <Hint>이 날은 근무에서 빠지는 날로 표시됩니다. (교육과 같은 방식) 같은 소모임 팀원의 "연가계획표"에서 빠지는 인원으로 계산됩니다.</Hint> : null}
          {type === 'careIn' || type === 'careOut' || type === 'careBoth' ? <Hint>근무는 그대로이고, 육아시간을 쓴 날로 표시됩니다. {type === 'careIn' ? '출근할 때 쓰면 당 앞에 육이 붙습니다.' : type === 'careOut' ? '퇴근할 때 쓰면 당 뒤에 육이 붙습니다.' : '출근과 퇴근 모두 쓰면 당 앞뒤로 육이 붙습니다.'} 같은 소모임에 들어 있는 배우자에게도 보입니다.</Hint> : null}
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
