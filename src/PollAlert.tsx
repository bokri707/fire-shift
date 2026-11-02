import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { isEventTitle } from './lib/events';
import { parse } from './lib/date';
import { groupKind, useStore } from './store';
import { useTheme } from './theme';

const KEY = 'fire-shift-pollseen-v1';

/** 이 폰에서 이미 알려 준 기록. g: 처음 기준을 잡은 소모임, p: 투표 id → N(새 투표를 알림) / F(확정을 알림) */
interface Seen { g: Record<string, true>; p: Record<string, 'N' | 'F'> }
interface Item { key: string; code: string; kind: 'team' | 'meet'; group: string; title: string; type: 'N' | 'F'; final: string }

const fmt = (d: string): string => { const p = parse(d); return p[1] + '월 ' + p[2] + '일'; };

/**
 * 같은 소모임의 누군가가 투표를 새로 올리거나 날짜를 확정하면 앱을 켰을 때(또는 쓰는 중에) 팝업으로 알려 줍니다.
 * 서버 변경 없음: 이미 받아오는 투표 목록을 이 폰에 저장한 기록과 비교만 합니다. 내가 올리거나 확정한 건 알리지 않습니다.
 * 처음 쓰는 소모임(가입 직후)에 이미 있던 투표는 알리지 않고 기준으로만 삼습니다.
 */
export default function PollAlert({ onGo }: { onGo: (kind: 'team' | 'meet', code: string) => void }): React.ReactElement | null {
  const t = useTheme();
  const { state } = useStore();
  const seen = useRef<Seen | null>(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then((raw) => {
      let v: Seen = { g: {}, p: {} };
      try { if (raw) { const o = JSON.parse(raw) as Seen; if (o && o.g && o.p) v = o; } } catch (e) { /* 깨졌으면 새로 시작 */ }
      seen.current = v;
    }).catch(() => { seen.current = { g: {}, p: {} }; }).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const groups = (state.cloud ? [{ code: state.cloud.code, name: state.cloud.name, kind: groupKind(state.cloud), members: state.members.length, polls: state.polls }] : [])
    .concat((state.others || []).map((g) => ({ code: g.code, name: g.name, kind: groupKind(g), members: g.members.length, polls: g.polls })));
  const mine = state.myPolls || [];
  const sig = JSON.stringify(groups.map((g) => [g.code, g.members, g.polls.map((p) => [p.id, p.final, p.title])])) + '|' + mine.join(',');

  useEffect(() => {
    const sn = seen.current;
    if (!ready || !sn) return;
    const found: Item[] = [];
    let dirty = false;
    groups.forEach((g) => {
      if (g.members === 0) return; // 아직 서버에서 받아오기 전
      const first = !sn.g[g.code];
      if (first) { sn.g[g.code] = true; dirty = true; }
      g.polls.forEach((p) => {
        if (isEventTitle(p.title)) return; // 팀 일정은 투표가 아님
        const st: 'N' | 'F' = p.final ? 'F' : 'N';
        const was = sn.p[p.id];
        if (was === st || was === 'F') return;
        sn.p[p.id] = st; dirty = true;
        if (first || mine.indexOf(p.id) >= 0) return; // 처음 기준 잡기, 내가 올린 것
        found.push({ key: p.id + st, code: g.code, kind: g.kind, group: g.name, title: p.title, type: was === 'N' ? 'F' : st, final: p.final });
      });
    });
    if (dirty) AsyncStorage.setItem(KEY, JSON.stringify(sn)).catch(() => undefined);
    if (found.length) setItems((cur) => cur.concat(found.filter((f) => !cur.some((c) => c.key === f.key))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sig]);

  if (!items.length) return null;
  const shown = items.slice(0, 4);
  const first = items[0];
  return (
    <Modal transparent animationType="fade" onRequestClose={() => setItems([])}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 420, backgroundColor: t.surface, borderRadius: 14, padding: 18, gap: 12 }}>
          <Text style={{ color: t.ink, fontSize: 17, fontWeight: '800' }}>모임 소식</Text>
          {shown.map((it) => (
            <View key={it.key} style={{ gap: 2 }}>
              <Text style={{ color: it.type === 'F' ? t.accent : t.duty, fontSize: 13, fontWeight: '800' }}>
                {it.type === 'F' ? '날짜가 확정됐어요' : '새 투표가 올라왔어요'} · {it.group}
              </Text>
              <Text style={{ color: t.ink, fontSize: 15 }}>
                {it.title}{it.type === 'F' && it.final ? ' → ' + fmt(it.final) : ''}
              </Text>
            </View>
          ))}
          {items.length > shown.length ? <Text style={{ color: t.ink2, fontSize: 13 }}>외 {items.length - shown.length}건</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
            <Pressable onPress={() => setItems([])} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: t.line }}>
              <Text style={{ color: t.ink, fontWeight: '700' }}>닫기</Text>
            </Pressable>
            <Pressable onPress={() => { setItems([]); onGo(first.kind, first.code); }} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: t.accent }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>보러 가기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
