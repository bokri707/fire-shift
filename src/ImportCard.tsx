import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { daysInMonth, fromIdx, idx, iso, parse } from './lib/date';
import { newId, useStore } from './store';
import { useTheme } from './theme';
import { Btn, Card, H2, Hint } from './ui';

interface Row { name: string; dates: string[] }

/** "11/5 김현수 교육", "11/23~25 정민희 교육", "11/13~11/28 임승태 특가" 같은 줄을 일정으로 바꿉니다. */
export function parseLines(text: string, year: number): { rows: Row[]; bad: string[] } {
  const rows: Row[] = [];
  const bad: string[] = [];
  text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 300).forEach((line) => {
    const m = /^(\d{1,2})\/(\d{1,2})(?:\s*[~\-]\s*(?:(\d{1,2})\/)?(\d{1,2}))?\s+(.+)$/.exec(line);
    if (!m) { bad.push(line); return; }
    const m1 = Number(m[1]); const d1 = Number(m[2]);
    const m2 = m[3] ? Number(m[3]) : m1; const d2 = m[4] ? Number(m[4]) : d1;
    if (m1 < 1 || m1 > 12 || m2 < 1 || m2 > 12 || d1 < 1 || d1 > daysInMonth(year, m1) || d2 < 1 || d2 > daysInMonth(year, m2)) { bad.push(line); return; }
    const a = iso(year, m1, d1); const b = iso(year, m2, d2);
    const len = idx(b) - idx(a);
    if (len < 0 || len > 60) { bad.push(line); return; }
    const dates: string[] = [];
    for (let i = 0; i <= len; i++) dates.push(fromIdx(idx(a) + i));
    rows.push({ name: m[5].trim(), dates });
  });
  return { rows, bad };
}

/**
 * [시험용] 사진에서 읽어 온 일정 목록을 한꺼번에 "내 일정"(이 폰에만 저장, 서버에 올리지 않음)에 넣습니다.
 * 사진 인식은 아직 앱 안에 없고, 목록은 사람이 붙여 넣습니다. 유료 기능 후보이며 config.ts의 IMPORT_TEST로 켜고 끕니다.
 */
export default function ImportCard(): React.ReactElement {
  const t = useTheme();
  const { state, today, update } = useStore();
  const year = parse(today)[0];
  const [text, setText] = useState('');
  const [done, setDone] = useState('');
  const { rows, bad } = parseLines(text, year);
  const have = (state.myEvents || []).map((e) => e.name + '|' + e.dates.join(','));
  const fresh = rows.filter((r) => have.indexOf(r.name + '|' + r.dates.join(',')) < 0);
  const put = (): void => {
    if (!fresh.length) return;
    update((s) => ({ ...s, myEvents: (s.myEvents || []).concat(fresh.map((r) => ({ id: newId(), name: r.name, dates: r.dates }))) }));
    setText(''); setDone(fresh.length + '건을 내 일정에 넣었습니다.');
  };
  return (
    <Card style={{ gap: 10 }}>
      <H2>일정 가져오기 (시험)</H2>
      <Hint>한 줄에 하나씩 "11/5 김현수 교육", "11/23~25 정민희 교육"처럼 붙여 넣으세요. 이 폰의 내 일정에만 들어가고 서버에는 올라가지 않습니다.</Hint>
      <TextInput
        value={text}
        onChangeText={(v: string) => { setText(v); setDone(''); }}
        multiline
        placeholder={'11/5 김현수 교육 (5~6)\n11/23~25 정민희 교육'}
        placeholderTextColor={t.ink2}
        style={{ minHeight: 120, borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink, textAlignVertical: 'top' }}
      />
      {rows.length || bad.length ? (
        <View style={{ gap: 2 }}>
          <Text style={{ color: t.ink, fontSize: 13 }}>읽은 줄 {rows.length}건 (이미 있는 {rows.length - fresh.length}건은 건너뜀){bad.length ? ' · 읽지 못한 줄 ' + bad.length + '건' : ''}</Text>
          {bad.slice(0, 5).map((b, i) => <Text key={i} style={{ color: t.sun, fontSize: 12 }}>✕ {b}</Text>)}
        </View>
      ) : null}
      {done ? <Text style={{ color: t.accent, fontSize: 13, fontWeight: '700' }}>{done}</Text> : null}
      <Btn label={fresh.length ? '내 일정에 ' + fresh.length + '건 넣기' : '내 일정에 넣기'} onPress={put} />
    </Card>
  );
}
