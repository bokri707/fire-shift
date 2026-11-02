import { AppState } from '../types';
import { isThree } from './shift';

export const DEFAULT_LEAVE = 21;

export interface LeaveUsage {
  is24: boolean;
  fullH: number;
  halfH: number;
  full: number;
  half: number;
  hourly: number;
  sickDays: number;
  sickExcess: number;
  usedH: number;
  totalH: number;
  remainH: number;
}

/** 시간(1일=8시간)을 "N일 M시간"으로 보여 줍니다. */
export function fmtLeave(h: number): string {
  const neg = h < 0;
  const a = Math.abs(h);
  const d = Math.floor(a / 8 + 1e-9);
  const r = Math.round((a - d * 8) * 10) / 10;
  const t = (d ? d + '일' : '') + (r ? (d ? ' ' : '') + r + '시간' : '');
  return (neg ? '-' : '') + (t || '0일');
}

/**
 * 한 해 연가 사용량 (e-사람 근무상황 종별 안내 기준, 1일 = 8시간).
 * - 일반 근무자: 전일연가 1일(8시간), 반일연가 0.5일(4시간)
 * - 24시간 근무자: 전일연가 2일(16시간, 설정에서 1일로 바꿀 수 있음), 반일연가는 늘 1일(8시간). 설정은 전일연가에만 적용
 * - 시간연가(지각·외출·조퇴 연가처리): 쓴 시간을 모두 더해 8시간을 1일로
 * - 병가(진단서 없음): 병가 하루를 전일연가와 같은 일수로 세고(24시간 근무자는 2일), 연 6일을 넘는 일수는 연가에서 공제 (진단서 첨부·공무상병가는 공제 없음)
 */
export function leaveUsage(st: AppState, year: number): LeaveUsage {
  const is24 = st.leave24 !== undefined ? st.leave24 : isThree(st.pattern);
  const full1 = is24 && st.leaveFull1 === true;
  const fullH = is24 && !full1 ? 16 : 8;
  const halfH = is24 ? 8 : 4;
  let full = 0; let half = 0; let hourly = 0; let sickDays = 0;
  const pre = year + '-';
  Object.keys(st.ex).forEach((k) => {
    if (k.indexOf(pre) !== 0) return;
    const e = st.ex[k];
    if (e.sample) return;
    if (e.type === 'leave') full++;
    else if (e.type === 'halfAm' || e.type === 'halfPm') half++;
    else if (e.type === 'hourly') hourly += e.hrs || 1;
    else if (e.type === 'sick') sickDays += fullH / 8;
  });
  const sickExcess = Math.max(0, sickDays - 6);
  const usedH = full * fullH + half * halfH + hourly + sickExcess * 8;
  const totalH = (st.leaveTotal !== undefined ? st.leaveTotal : DEFAULT_LEAVE) * 8;
  return { is24, fullH, halfH, full, half, hourly, sickDays, sickExcess, usedH, totalH, remainH: totalH - usedH };
}
