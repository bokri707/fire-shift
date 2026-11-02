/** 휴가·휴무 세부 종류 (웹 시험 적용, 2026-11-02). 달력 칸에는 2글자 이름을 쓰고, 서버에는 '기타'로 올립니다. */
export const EXTRA_LEAVE = {
  halfAm: { chip: '반가', sub: '오전', name: '반일연가(오전)', kind: 'leave' },
  halfPm: { chip: '반가', sub: '오후', name: '반일연가(오후)', kind: 'leave' },
  sick: { chip: '병가', sub: '', name: '병가(진단서 없음)', kind: 'edu' },
  sickCert: { chip: '병가', sub: '진단서', name: '병가(진단서 첨부)', kind: 'edu' },
  sickWork: { chip: '병가', sub: '공무상', name: '공무상병가', kind: 'edu' },
  official: { chip: '공가', sub: '', name: '공가', kind: 'edu' },
  condol: { chip: '경조', sub: '', name: '경조사휴가', kind: 'edu' },
  family: { chip: '돌봄', sub: '', name: '가족돌봄휴가', kind: 'edu' },
  dutyOff: { chip: '당휴', sub: '', name: '당직휴무', kind: 'edu' },
  subOff: { chip: '대휴', sub: '', name: '대체휴무', kind: 'edu' },
  turnOff: { chip: '순휴', sub: '', name: '순번휴무', kind: 'edu' },
  prize: { chip: '포상', sub: '', name: '포상휴가', kind: 'edu' },
  tour: { chip: '관외', sub: '', name: '관외여행', kind: 'edu' },
  fire: { chip: '소방', sub: '', name: '소방(기타)', kind: 'edu' },
  absent: { chip: '결근', sub: '', name: '결근', kind: 'edu' },
} as const;

export type ExtraType = keyof typeof EXTRA_LEAVE;

/** 24시간 근무자가 주간·야간·전일로 나눠 쓰는 휴가 */
export const PART_TYPES: string[] = ['official', 'sick', 'sickCert', 'sickWork', 'family', 'condol', 'prize'];

/** 하루 일수: 24시간 근무자는 주간 1일·야간 1일·전일 2일, 그 밖은 1일 */
export function dayWeight(is24: boolean, part?: string): number {
  return is24 && (!part || part === '전일') ? 2 : 1;
}

/** 서버(팀원)에 올리는 값. 올리지 않으면 null. 주간·야간만 쓴 휴가는 '기타@주'·'기타@야'로 올립니다. */
export function wireEx(e: { type: string; part?: string }): string | null {
  if (e.type === 'memo' || e.type === 'hourly') return null;
  if (isExtra(e.type)) {
    if (PART_TYPES.indexOf(e.type) >= 0 && (e.part === '주간' || e.part === '야간')) return 'etc@' + (e.part === '주간' ? '주' : '야');
    return 'etc';
  }
  return e.type;
}

export function isExtra(t: string): t is ExtraType {
  return Object.prototype.hasOwnProperty.call(EXTRA_LEAVE, t);
}
