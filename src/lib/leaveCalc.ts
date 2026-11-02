import { AppState } from '../types';
import { EXTRA_LEAVE, PART_TYPES, dayWeight, isExtra } from './leave';
import { isThree } from './shift';

export const DEFAULT_LEAVE = 21;
/** 진단서 없는 병가는 연 6일까지 연가에서 공제하지 않습니다. */
export const SICK_FREE_DAYS = 6;
export const FAMILY_LIMIT = 10;

export interface LeaveRecord {
  date: string;
  /** 종류 이름 (예: 연가(전일), 병가(진단서 없음)) */
  name: string;
  /** 주간·야간·전일, 시간 등 */
  detail: string;
  /** 연가에서 공제되는 시간 (1일 = 8시간) */
  deductH: number;
  memo: string;
}

export interface LeaveUsage {
  is24: boolean;
  fullH: number;
  halfH: number;
  full: number;
  /** 전일연가로 쓴 시간 합계 (24시간 근무자는 날마다 2일 또는 1일) */
  fullUsedH: number;
  half: number;
  hourly: number;
  /** 진단서 없는 병가 사용일수 (24시간 근무자는 주간 1일·야간 1일·전일 2일) */
  sickDays: number;
  /** 가족돌봄휴가 사용일수 (연 10일 한도, 같은 방식으로 셈) */
  family: number;
  /** 결근 횟수 (연가에서 공제, 공제 일수는 확인 전이라 전일연가와 같게 셉니다) */
  absent: number;
  sickExcess: number;
  usedH: number;
  totalH: number;
  remainH: number;
  records: LeaveRecord[];
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
 * - 24시간 근무자: 전일연가 2일(16시간, 날짜마다 1일로 바꿀 수 있음), 반일연가는 늘 1일(8시간)
 * - 시간연가(지각·외출·조퇴 연가처리): 쓴 시간을 모두 더해 8시간을 1일로
 * - 병가(진단서 없음): 24시간 근무자는 주간 1일·야간 1일·전일 2일로 세고, 연 6일을 넘는 일수는 연가에서 공제
 *   (진단서 첨부·공무상병가는 공제 없음)
 * - 가족돌봄: 같은 방식으로 세어 연 10일 한도에 표시만 합니다.
 * - 이 해에 쓴 휴가·휴무를 날짜순으로 모아 records에 담습니다 (연가 공제 여부 포함).
 */
export function leaveUsage(st: AppState, year: number): LeaveUsage {
  const is24 = st.leave24 !== undefined ? st.leave24 : isThree(st.pattern);
  const fullH = is24 ? 16 : 8;
  const halfH = is24 ? 8 : 4;
  let full = 0; let fullUsedH = 0; let half = 0; let hourly = 0; let sickDays = 0; let family = 0; let absent = 0;
  const records: LeaveRecord[] = [];
  const pre = year + '-';
  Object.keys(st.ex).sort().forEach((k) => {
    if (k.indexOf(pre) !== 0) return;
    const e = st.ex[k];
    if (e.sample) return;
    const memo = e.memo || '';
    if (e.type === 'leave') {
      const h = is24 && !e.full1 ? 16 : 8;
      full++; fullUsedH += h;
      records.push({ date: k, name: '연가(전일)', detail: is24 ? (h === 16 ? '2일로 계산' : '1일로 계산') : '', deductH: h, memo });
    } else if (e.type === 'halfAm' || e.type === 'halfPm') {
      half++;
      records.push({ date: k, name: e.type === 'halfAm' ? '반일연가(오전)' : '반일연가(오후)', detail: '', deductH: halfH, memo });
    } else if (e.type === 'hourly') {
      const h = e.hrs || 1;
      hourly += h;
      records.push({ date: k, name: e.hkind || '시간연가', detail: h + '시간', deductH: h, memo });
    } else if (e.type === 'absent') {
      absent++;
      records.push({ date: k, name: '결근', detail: '', deductH: fullH, memo });
    } else if (isExtra(e.type)) {
      const part = PART_TYPES.indexOf(e.type) >= 0 && is24 ? (e.part || '전일') : '';
      let deductH = 0;
      if (e.type === 'sick') {
        const w = dayWeight(is24, e.part);
        const before = sickDays;
        sickDays += w;
        deductH = (Math.max(0, sickDays - SICK_FREE_DAYS) - Math.max(0, before - SICK_FREE_DAYS)) * 8;
      } else if (e.type === 'family') {
        family += dayWeight(is24, e.part);
      }
      records.push({ date: k, name: EXTRA_LEAVE[e.type].name, detail: part, deductH, memo });
    }
  });
  const sickExcess = Math.max(0, sickDays - SICK_FREE_DAYS);
  const usedH = fullUsedH + half * halfH + hourly + sickExcess * 8 + absent * fullH;
  const totalH = (st.leaveTotal !== undefined ? st.leaveTotal : DEFAULT_LEAVE) * 8;
  return { is24, fullH, halfH, full, fullUsedH, half, hourly, sickDays, family, absent, sickExcess, usedH, totalH, remainH: totalH - usedH, records };
}
