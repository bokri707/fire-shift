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
} as const;

export type ExtraType = keyof typeof EXTRA_LEAVE;

export function isExtra(t: string): t is ExtraType {
  return Object.prototype.hasOwnProperty.call(EXTRA_LEAVE, t);
}
