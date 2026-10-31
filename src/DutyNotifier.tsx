import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { cancelAll, ensurePermission, notifySupported, reschedule, setupHandler } from './lib/notify';
import { allMeets } from './lib/shift';
import { useStore } from './store';

const KEY = 'fire-shift-notify-v1';
/** on=근무 알림, meet=모임 알림, hour=근무 알림 시각(전날), meetEve=모임 전날 알림 시각 */
export interface NotifyPref { on: boolean; meet: boolean; hour: number; meetEve: number }
const DEF: NotifyPref = { on: false, meet: false, hour: 21, meetEve: 9 };
const hr = (v: unknown, d: number): number => (typeof v === 'number' && v >= 0 && v <= 23 ? v : d);

/** 설정 화면과 알림 예약기가 같은 값을 보도록 하는 아주 작은 공유 저장소 */
const listeners = new Set<(p: NotifyPref) => void>();
let cur: NotifyPref = DEF;
let loaded = false;

async function load(): Promise<NotifyPref> {
  if (loaded) return cur;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) { const p = JSON.parse(raw) as NotifyPref; cur = { on: !!p.on, meet: !!p.meet, hour: hr(p.hour, 21), meetEve: hr(p.meetEve, 9) }; }
  } catch (e) { /* 기본값 사용 */ }
  loaded = true;
  return cur;
}

export function setNotifyPref(p: NotifyPref): void {
  cur = p;
  AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => undefined);
  listeners.forEach((f) => f(p));
}

export function useNotifyPref(): NotifyPref {
  const [p, setP] = useState<NotifyPref>(cur);
  useEffect(() => {
    let alive = true;
    load().then((v) => { if (alive) setP(v); });
    listeners.add(setP);
    return () => { alive = false; listeners.delete(setP); };
  }, []);
  return p;
}

/** 근무표가 바뀔 때마다 앞으로 14일치 알림을 다시 예약합니다. 화면에는 아무것도 그리지 않습니다. */
export default function DutyNotifier(): null {
  const { state, today } = useStore();
  const pref = useNotifyPref();
  const sig = JSON.stringify([state.pattern, state.anchor, state.team, state.manual, state.ex, today, pref, allMeets(state)]);

  useEffect(() => { setupHandler(); }, []);

  useEffect(() => {
    if (!notifySupported()) return undefined;
    let alive = true;
    (async () => {
      if (!pref.on && !pref.meet) { await cancelAll(); return; }
      if (!(await ensurePermission())) return;
      if (!alive) return;
      await reschedule(state, today, { duty: pref.on, meet: pref.meet, hour: pref.hour, meetEve: pref.meetEve }, 14);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return null;
}
