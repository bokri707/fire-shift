import { Platform } from 'react-native';
import { fromIdx, idx, parse } from './date';
import { allMeets, eff } from './shift';
import { AppState } from '../types';

/* 폰(안드로이드/아이폰) 앱 안에서만 동작합니다. 웹에서는 아무 일도 하지 않습니다. 서버는 쓰지 않습니다. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Notif = any;

function mod(): Notif | null {
  if (Platform.OS === 'web') return null;
  try {
    // 웹 빌드에서도 패키지만 설치돼 있으면 문제없도록 필요할 때 불러옵니다.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch (e) { return null; }
}

export const notifySupported = (): boolean => mod() !== null;

/** 알림 권한을 확인하고 필요하면 요청합니다. 허용되면 true. */
export async function ensurePermission(): Promise<boolean> {
  const N = mod();
  if (!N) return false;
  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('duty', { name: '근무 알림', importance: N.AndroidImportance.HIGH });
    }
    const cur = await N.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await N.requestPermissionsAsync();
    return !!req.granted;
  } catch (e) { return false; }
}

export async function cancelAll(): Promise<void> {
  const N = mod();
  if (!N) return;
  try { await N.cancelAllScheduledNotificationsAsync(); } catch (e) { /* 무시 */ }
}

/** 알림 하나를 예약합니다. 이미 지난 시각이면 건너뜁니다. */
async function schedule(N: Notif, when: Date, title: string, body: string): Promise<boolean> {
  if (when.getTime() <= Date.now()) return false;
  try {
    await N.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'duty' },
    });
    return true;
  } catch (e) { return false; }
}

const at = (iso: string, h: number): Date => { const p = parse(iso); return new Date(p[0], p[1] - 1, p[2], h, 0, 0); };

/**
 * 이미 있던 예약은 모두 지우고 다시 만듭니다.
 *  - duty: 앞으로 days일 중 근무하는 날의 전날 hour시에 알림
 *  - meet: 확정된 모임의 전날 오전 9시, 당일 오전 8시에 알림
 */
export async function reschedule(st: AppState, today: string, opt: { duty: boolean; meet: boolean; hour: number }, days: number): Promise<number> {
  const N = mod();
  if (!N) return 0;
  await cancelAll();
  let n = 0;
  if (opt.duty) {
    const start = idx(today);
    for (let i = start; i < start + days + 1; i++) {
      const d = fromIdx(i);
      const e = eff(st, d);
      if (!e.works) continue;
      const name = e.label + (e.kind === 'swap' ? ' (맞교대)' : '');
      if (await schedule(N, at(fromIdx(i - 1), opt.hour), '내일 근무', '내일은 ' + name + ' 근무예요.')) n++;
    }
  }
  if (opt.meet) {
    const meets = allMeets(st).filter((m) => m.final >= today);
    for (const m of meets) {
      const name = (m.group ? '[' + m.group + '] ' : '') + m.title;
      if (await schedule(N, at(fromIdx(idx(m.final) - 1), 9), '내일 모임', name)) n++;
      if (await schedule(N, at(m.final, 8), '오늘 모임', name)) n++;
    }
  }
  return n;
}

export function setupHandler(): void {
  const N = mod();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  } catch (e) { /* 무시 */ }
}
