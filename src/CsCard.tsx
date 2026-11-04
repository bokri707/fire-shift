import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { CS_CATS, CsPost, csDelete, csList, csSubmit } from './lib/cs';
import { useTheme } from './theme';
import { Btn, Card, Chip, H2, Hint } from './ui';

const STATUS: Record<string, string> = { new: '접수', read: '확인', answered: '답변완료', closed: '종료' };
const catLabel = (v: string): string => (CS_CATS.find((c) => c.v === v) || { label: '기타' }).label;

/** 설정 화면의 "문의하기" 카드. 카드를 펼칠 때와 보낸 직후에만 서버에서 목록을 가져옵니다. */
export default function CsCard(): React.ReactElement {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState('bug');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [bad, setBad] = useState(false);
  const [posts, setPosts] = useState<CsPost[] | null>(null);
  const [armedId, setArmedId] = useState('');

  const say = (m: string, isBad: boolean): void => { setMsg(m); setBad(isBad); };

  const load = async (): Promise<void> => {
    const r = await csList();
    if (r.ok) setPosts(r.posts);
    else { setPosts(null); say(r.err, true); }
  };

  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    if (next) { setMsg(''); load(); }
  };

  const send = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const r = await csSubmit(cat, body);
    setBusy(false);
    if (!r.ok) { say(r.err, true); return; }
    setBody('');
    say('문의를 보냈어요. 답변은 며칠 걸릴 수 있어요. 아래 "내 문의"에서 확인할 수 있어요.', false);
    load();
  };

  const del = async (id: string): Promise<void> => {
    if (armedId !== id) { setArmedId(id); setTimeout(() => setArmedId(''), 4000); return; }
    setArmedId('');
    if (await csDelete(id)) setPosts((p) => (p ? p.filter((x) => x.id !== id) : p));
    else say('지우지 못했어요. 잠시 뒤 다시 해 주세요.', true);
  };

  return (
    <Card style={{ gap: 10 }}>
      <H2>문의하기</H2>
      {!open ? <Btn ghost label="문의 남기기 / 내 문의 보기" onPress={toggle} /> : (
        <View style={{ gap: 10 }}>
          <Hint>이름, 전화번호 같은 개인정보는 쓰지 마세요.</Hint>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CS_CATS.map((c) => <Chip key={c.v} label={c.label} on={cat === c.v} onPress={() => setCat(c.v)} />)}
          </View>
          <TextInput
            value={body} onChangeText={(v: string) => { setBody(v.slice(0, 500)); setMsg(''); }} multiline maxLength={500}
            placeholder="내용을 써 주세요 (5~500자)" placeholderTextColor={t.ink2}
            style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, color: t.ink, minHeight: 90, maxHeight: 180, fontSize: 14, textAlignVertical: 'top' }}
          />
          <Text style={{ color: t.ink2, fontSize: 12, textAlign: 'right' }}>{body.length} / 500</Text>
          <Btn label={busy ? '보내는 중…' : '보내기'} onPress={() => { send(); }} disabled={busy} />
          {msg ? <Hint bad={bad} keep>{msg}</Hint> : null}

          <Text style={{ color: t.ink, fontSize: 14, fontWeight: '700', marginTop: 4 }}>내 문의</Text>
          {posts === null ? null : posts.length === 0 ? <Text style={{ color: t.ink2, fontSize: 13 }}>보낸 문의가 없어요.</Text> : posts.map((p) => (
            <View key={p.id} style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, gap: 6 }}>
              <Text style={{ color: t.ink2, fontSize: 12 }}>{catLabel(p.category)} · {STATUS[p.status] || p.status} · {String(p.created_at).slice(0, 10)}</Text>
              <Text style={{ color: t.ink, fontSize: 14, lineHeight: 20 }}>{p.body}</Text>
              {p.reply ? (
                <View style={{ backgroundColor: t.line, borderRadius: 6, padding: 8 }}>
                  <Text style={{ color: t.ink, fontSize: 13, lineHeight: 19 }}>답변: {p.reply}</Text>
                </View>
              ) : null}
              <Btn small ghost label={armedId === p.id ? '한 번 더 눌러 삭제' : '삭제'} onPress={() => { del(p.id); }} />
            </View>
          ))}
          <Btn ghost small label="닫기" onPress={toggle} />
        </View>
      )}
    </Card>
  );
}
