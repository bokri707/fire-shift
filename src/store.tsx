import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { fromIdx, idx, todayISO } from './lib/date';
import { Person, THREE, roster } from './lib/shift';
import { AppState } from './types';

const KEY = 'fire-shift-rn-v1';

function defaults(today: string): AppState {
  const ti = idx(today);
  return {
    team: 2,
    anchor: today,
    pattern: THREE,
    manual: {},
    base3: fromIdx(ti - 1),
    configured: false,
    nick: '',
    ex: {
      [fromIdx(ti + 3)]: { type: 'swap', who: '김 소방사', memo: '', sample: true },
      [fromIdx(ti + 7)]: { type: 'swap', who: '이 소방교', memo: '', sample: true },
    },
    members: [
      { id: 'sample1', name: '김소방', team: 1, ex: {}, sample: true },
      { id: 'sample2', name: '이소방', team: 3, ex: {}, sample: true },
      { id: 'sample3', name: '박소방', team: 1, ex: {}, sample: true },
    ],
    polls: [],
    cloud: null,
  };
}

export type GroupKind = 'team' | 'meet';
export const groupKind = (g: { kind?: GroupKind }): GroupKind => (g.kind === 'meet' ? 'meet' : 'team');

/** 보고 있는 소모임을 code인 소모임으로 바꿉니다. 보던 소모임은 others로 보관합니다. */
export function switchGroup(s: AppState, code: string): AppState {
  if (!s.cloud || s.cloud.code === code) return s;
  const g = (s.others || []).find((x) => x.code === code);
  if (!g) return s;
  const rest = (s.others || []).filter((x) => x.code !== code);
  rest.push({ ...s.cloud, members: s.members, polls: s.polls });
  return { ...s, cloud: { code: g.code, name: g.name, myId: g.myId, nick: g.nick, kind: g.kind, pair: g.pair }, members: g.members, polls: g.polls, others: rest };
}

/** 이 종류의 소모임을 보고 있지 않으면, 가입한 같은 종류 소모임 중 하나로 바꿉니다. (없으면 그대로) */
export function focusKind(s: AppState, kind: GroupKind): AppState {
  if (s.cloud && groupKind(s.cloud) === kind) return s;
  const g = (s.others || []).find((o) => groupKind(o) === kind);
  return g ? switchGroup(s, g.code) : s;
}

/** 부부·육아 탭이 배우자를 찾을 소모임 코드: 고른 것 → 부부(가족)로 표시된 것 → 사람이 있는 모임 → 지금 소모임 */
export function pairGroupCode(s: AppState): string {
  if (!s.cloud) return '';
  const gs: { code: string; kind?: GroupKind; pair?: boolean; n: number }[] = [{ code: s.cloud.code, kind: s.cloud.kind, pair: s.cloud.pair, n: s.members.length }]
    .concat((s.others || []).map((g) => ({ code: g.code, kind: g.kind, pair: g.pair, n: g.members.length })));
  const picked = gs.find((g) => g.code === s.pairCode);
  const auto = gs.find((g) => g.pair === true) || gs.find((g) => groupKind(g) === 'meet' && g.n > 0) || gs[0];
  return (picked || auto).code;
}

/** 배우자: 부부(가족)로 표시했거나 설정에서 고른 소모임에서 나를 뺀 첫 번째 사람. 달력에 육아시간을 파란 점으로 보여 줄 때 씁니다. */
export function spouseOf(s: AppState): Person | undefined {
  if (!s.cloud) return undefined;
  const code = pairGroupCode(s);
  const g = [s.cloud as { code: string; pair?: boolean }].concat((s.others || []) as { code: string; pair?: boolean }[]).find((x) => x.code === code);
  if (!g || !(g.pair === true || s.pairCode === code)) return undefined;
  return roster(switchGroup(s, code)).find((x) => !x.isMe);
}

export type Update = (fn: (s: AppState) => AppState) => void;

interface Store {
  state: AppState;
  update: Update;
  today: string;
  resetAll: () => void;
  netErr: string;
  reportErr: (m: string) => void;
  syncedAt: number;
  markSynced: () => void;
}

/** 마지막으로 서버에 쓴 시각. 직후의 서버 응답이 방금 한 입력을 덮어쓰지 않게 하는 데 씁니다. */
export const sync = { lastWrite: 0 };
export function markWrite(): void { sync.lastWrite = Date.now(); }

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider가 없습니다.');
  return v;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function StoreProvider({ children }: { children: React.ReactNode }): React.ReactElement | null {
  const [state, setState] = useState<AppState | null>(null);
  const [today, setToday] = useState<string>(todayISO());
  const [netErr, setNetErr] = useState('');
  const [syncedAt, setSyncedAt] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        let s: AppState | null = null;
        if (raw) {
          try {
            const p = JSON.parse(raw) as AppState;
            if (p && p.anchor && p.ex && p.team) {
              s = { ...defaults(todayISO()), ...p };
              if (!p.base3) s.base3 = fromIdx(idx(p.anchor) - (p.team - 1));
              // 예전 버전에서 이미 소모임에 들어가 있던 사람은 지금 보던 탭을 그대로 봅니다.
              if (p.teamOn === undefined && (p.cloud || (p.others && p.others.length))) s.teamOn = true;
              if (p.pairOn === undefined && p.cloud) s.pairOn = true;
            }
          } catch (e) { /* 저장값이 깨졌으면 기본값으로 시작합니다 */ }
        }
        if (alive) { setState(s || defaults(todayISO())); loaded.current = true; }
      })
      .catch(() => { if (alive) { setState(defaults(todayISO())); loaded.current = true; } });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!state || !loaded.current) return;
    const h = setTimeout(() => { AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined); }, 300);
    return () => clearTimeout(h);
  }, [state]);

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (st) => { if (st === 'active') setToday(todayISO()); });
    return () => sub.remove();
  }, []);

  const update = useCallback<Update>((fn) => { setState((prev) => (prev ? fn(prev) : prev)); }, []);
  const resetAll = useCallback(() => { setState(defaults(todayISO())); }, []);
  const reportErr = useCallback((m: string) => { setNetErr(m); }, []);
  const markSynced = useCallback(() => { setSyncedAt(Date.now()); }, []);

  if (!state) return null;
  return <Ctx.Provider value={{ state, update, today, resetAll, netErr, reportErr, syncedAt, markSynced }}>{children}</Ctx.Provider>;
}
