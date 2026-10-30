import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { fromIdx, idx, todayISO } from './lib/date';
import { THREE } from './lib/shift';
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
