import React, { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { daysInMonth, fromIdx, idx, iso, parse } from './lib/date';
import { newId, useStore } from './store';
import { useTheme } from './theme';
import { Btn, Card, H2, Hint } from './ui';

interface Row { name: string; dates: string[] }


interface WebDoc {
  createElement: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
const CODE_KEY = 'fire-shift-import-code';
function webStore(k: string, v?: string): string {
  try {
    const ls = (globalThis as unknown as { localStorage?: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } }).localStorage;
    if (!ls) return '';
    if (v !== undefined) { ls.setItem(k, v); return v; }
    return ls.getItem(k) || '';
  } catch (e) { return ''; }
}
/** 웹에서 사진을 고르거나 찍게 하고, 긴 변 1600px로 줄인 JPEG(base64)를 돌려줍니다. */
function pickPhoto(): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = (globalThis as unknown as { document?: WebDoc }).document;
    if (!doc) { reject(new Error('web only')); return; }
    const inp = doc.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) { reject(new Error('no file')); return; }
      const url = URL.createObjectURL(f);
      const im = new (globalThis as any).Image(); // eslint-disable-line @typescript-eslint/no-explicit-any
      im.onload = () => {
        const sc = Math.min(1, 1600 / Math.max(im.width, im.height));
        const c = doc.createElement('canvas');
        c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(String(c.toDataURL('image/jpeg', 0.85)).split(',')[1] || '');
      };
      im.onerror = () => reject(new Error('bad image'));
      im.src = url;
    };
    inp.click();
  });
}

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
  const [code, setCode] = useState(webStore(CODE_KEY));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { rows, bad } = parseLines(text, year);
  const have = (state.myEvents || []).map((e) => e.name + '|' + e.dates.join(','));
  const fresh = rows.filter((r) => have.indexOf(r.name + '|' + r.dates.join(',')) < 0);
  const put = (): void => {
    if (!fresh.length) return;
    update((s) => ({ ...s, myEvents: (s.myEvents || []).concat(fresh.map((r) => ({ id: newId(), name: r.name, dates: r.dates }))) }));
    setText(''); setDone(fresh.length + '건을 내 일정에 넣었습니다.');
  };
  const photo = async (): Promise<void> => {
    setErr(''); setDone('');
    if (!code.trim()) { setErr('시험 코드를 먼저 입력하세요.'); return; }
    webStore(CODE_KEY, code.trim());
    setBusy(true);
    try {
      const image = await pickPhoto();
      const r = await fetch(SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/read-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
        body: JSON.stringify({ code: code.trim(), image, mime: 'image/jpeg', year }),
      });
      if (r.status === 403) { setErr('시험 코드가 맞지 않습니다.'); return; }
      if (!r.ok) { setErr('사진을 읽지 못했습니다. 잠시 뒤 다시 해 보세요.'); return; }
      const d = (await r.json()) as { text?: string };
      setText((d.text || '').trim());
      if (!d.text) setErr('읽을 수 있는 일정이 없습니다.');
    } catch (e) { setErr('사진을 가져오지 못했습니다.'); } finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: 10 }}>
      <H2>일정 가져오기 (시험)</H2>
      <Hint>사진을 찍으면 아래 칸에 한 줄에 하나씩 읽어 옵니다. 틀린 곳은 고친 뒤 "넣기"를 누르세요. 글을 직접 붙여 넣어도 됩니다. 사진은 읽는 즉시 버려지고 저장되지 않으며, 넣은 일정은 이 기기의 내 일정에만 저장됩니다.</Hint>
      {Platform.OS === 'web' ? (
        <View style={{ gap: 8 }}>
          <TextInput value={code} onChangeText={setCode} placeholder="시험 코드" placeholderTextColor={t.ink2} secureTextEntry style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink }} />
          <Btn label={busy ? '사진 읽는 중…' : '📷 사진으로 가져오기'} onPress={() => { if (!busy) void photo(); }} />
          {err ? <Text style={{ color: t.sun, fontSize: 13 }}>{err}</Text> : null}
        </View>
      ) : null}
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
