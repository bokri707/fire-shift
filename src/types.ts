export type Kind = 'duty' | 'off' | 'leave' | 'edu' | 'swap';
export type ExType = 'leave' | 'edu' | 'swap' | 'care';

/** 하루 근무 표시: l=칸에 쓰는 글자(당·비·주·야·휴 등), w=근무하는 날인지 */
export interface PDay { l: string; w: boolean }

/** 근무 형태. cycle=반복 주기, week=요일마다 같음(일근), manual=날짜마다 직접 입력 */
export interface Pattern {
  t: 'cycle' | 'week' | 'manual';
  n: string;
  d: PDay[];
  /** week: 공휴일은 쉼 */
  h?: boolean;
}

export interface Ex {
  type: ExType;
  who: string;
  memo: string;
  sample?: boolean;
}

export interface Member {
  id: string;
  name: string;
  team: number;
  ex: Record<string, string>;
  sample?: boolean;
}

export interface Poll {
  id: string;
  title: string;
  dates: string[];
  final: string;
  at: number;
  /** 사람 id → 가능한 날짜. 내 표는 항상 'me' 키로 둡니다. */
  votes: Record<string, string[]>;
}

export interface CloudInfo {
  code: string;
  name: string;
  myId: string;
  /** 이 소모임에서 쓰는 내 별명 (없으면 기본 별명 nick) */
  nick?: string;
}

/** 내가 들어가 있는 소모임 하나의 캐시 (지금 보고 있지 않은 소모임) */
export interface Group extends CloudInfo {
  members: Member[];
  polls: Poll[];
}

export interface AppState {
  team: number;
  anchor: string;
  /** 내 근무 형태 (3교대는 team·anchor 사용, 다른 주기는 anchor가 주기의 첫날) */
  pattern: Pattern;
  /** 직접 입력형: 날짜 → 근무 글자 */
  manual: Record<string, string>;
  /** 3교대 동료 계산용: 1팀이 당직인 기준일 */
  base3: string;
  ex: Record<string, Ex>;
  configured: boolean;
  nick: string;
  members: Member[];
  polls: Poll[];
  /** 이 폰에서 올린 투표 id (확정은 올린 사람만) */
  myPolls?: string[];
  cloud: CloudInfo | null;
  /** 지금 보고 있지 않은 다른 소모임들 (cloud/members/polls는 지금 보는 소모임) */
  others?: Group[];
}
