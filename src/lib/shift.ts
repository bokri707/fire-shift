import { AppState, Ex, Kind, Pattern, Poll } from '../types';
import { fromIdx, idx, wdOf } from './date';
import { holName } from './holidays';

export const LBL: Record<Kind, string> = { duty: '당직', off: '비번', leave: '연가', edu: '교육', swap: '맞교대' };

const D = (l: string, w: boolean) => ({ l, w });

export const THREE: Pattern = { t: 'cycle', n: '3교대 (당·비·비)', d: [D('당', true), D('비', false), D('비', false)] };
export const PRESETS: Pattern[] = [
  THREE,
  { t: 'cycle', n: '4조 2교대 (주·야·비·휴)', d: [D('주', true), D('야', true), D('비', false), D('휴', false)] },
  { t: 'cycle', n: '2교대 (주·주·야·야·휴·휴)', d: [D('주', true), D('주', true), D('야', true), D('야', true), D('휴', false), D('휴', false)] },
  { t: 'week', n: '일근 (월~금)', d: [D('휴', false), D('근', true), D('근', true), D('근', true), D('근', true), D('근', true), D('휴', false)], h: true },
  { t: 'cycle', n: '내 주기 만들기', d: [D('주', true), D('야', true), D('휴', false)] },
  { t: 'manual', n: '매달 직접 입력', d: [] },
];

export const WORK_LABELS = ['당', '주', '야', '저', '근'];
export const OFF_LABELS = ['비', '휴'];
export const isWorkLabel = (l: string): boolean => OFF_LABELS.indexOf(l) < 0;

export const isThree = (p: Pattern): boolean =>
  p.t === 'cycle' && p.d.length === 3 && p.d[0].l === '당' && p.d[0].w && !p.d[1].w && !p.d[2].w;

const longLabel = (l: string): string => (l === '당' ? '당직' : l === '비' ? '비번' : l);

export interface BaseDay { l: string; w: boolean; pos: number }

/** 근무 형태로 계산한 그날의 기본 근무(연가·교육·맞교대 반영 전) */
export function baseDay(pat: Pattern, anchor: string, manual: Record<string, string>, s: string): BaseDay {
  if (pat.t === 'cycle' && pat.d.length) {
    const n = pat.d.length;
    const pos = (((idx(s) - idx(anchor)) % n) + n) % n;
    return { l: pat.d[pos].l, w: pat.d[pos].w, pos };
  }
  if (pat.t === 'week' && pat.d.length === 7) {
    if (pat.h && holName(s)) return { l: '휴', w: false, pos: 0 };
    const x = pat.d[wdOf(s)];
    return { l: x.l, w: x.w, pos: 0 };
  }
  const l = manual[s] || '휴';
  return { l, w: isWorkLabel(l), pos: 0 };
}

/** 3교대 전용 위치 (0=당직, 1·2=비번) */
export function posOf(anchor: string, s: string): number {
  return (((idx(s) - idx(anchor)) % 3) + 3) % 3;
}

export interface Eff {
  iso: string;
  pos: number;
  base: 'duty' | 'off';
  kind: Kind;
  label: string;
  works: boolean;
  sub: string;
  e: Ex | null;
}

export function eff(st: AppState, s: string): Eff {
  const bd = baseDay(st.pattern, st.anchor, st.manual, s);
  const base: 'duty' | 'off' = bd.w ? 'duty' : 'off';
  const e = st.ex[s] || null;
  const r: Eff = { iso: s, pos: bd.pos, base, kind: base, label: longLabel(bd.l), works: bd.w, sub: '', e };
  if (e) {
    if (e.type === 'leave') { r.kind = 'leave'; r.label = '연가'; r.works = false; }
    else if (e.type === 'edu') { r.kind = 'edu'; r.label = '교육'; r.works = false; }
    else if (e.type === 'swap') {
      r.kind = 'swap'; r.label = '맞교대';
      if (base === 'duty') { r.works = false; r.sub = '쉼'; } else { r.works = true; r.sub = '근무'; }
    }
  }
  return r;
}

export function dutyTeam(st: AppState, s: string): number {
  return ((st.team - 1 + posOf(st.anchor, s)) % 3) + 1;
}

/** 1팀이 당직인 날(기준일) */
export function teamBase(st: AppState): string {
  return st.base3;
}

export interface Person {
  id: string;
  name: string;
  team: number;
  anchor: string;
  ex: Record<string, string>;
  isMe: boolean;
  pat: Pattern;
  manual: Record<string, string>;
}

/* ---- 서버에는 근무 형태도 ex 안에 함께 올립니다 (서버 구조 변경 없이). 키 '_p' = 형태, 'b:날짜' = 직접 입력한 근무 ---- */
export function encPattern(p: Pattern, anchor: string): string {
  const n = p.n.replace(/[|,:]/g, ' ');
  return [p.t, n, p.h ? '1' : '0', anchor, p.d.map((x) => x.l + ':' + (x.w ? '1' : '0')).join(',')].join('|');
}

export function decPattern(v: string): { pat: Pattern; anchor: string } | null {
  const a = v.split('|');
  if (a.length !== 5) return null;
  const t = a[0];
  if (t !== 'cycle' && t !== 'week' && t !== 'manual') return null;
  const d = a[4] ? a[4].split(',').map((x) => { const q = x.split(':'); return { l: q[0] || '휴', w: q[1] === '1' }; }) : [];
  if (t === 'cycle' && d.length < 1) return null;
  if (t === 'week' && d.length !== 7) return null;
  return { pat: { t, n: a[1], d, h: a[2] === '1' }, anchor: a[3] };
}

export function manualFromEx(ex: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.keys(ex).forEach((k) => { if (k.indexOf('b:') === 0) out[k.slice(2)] = ex[k]; });
  return out;
}

export function roster(st: AppState): Person[] {
  const meEx: Record<string, string> = {};
  Object.keys(st.ex).forEach((k) => { meEx[k] = st.ex[k].type; });
  const list: Person[] = [{ id: 'me', name: st.nick || '나', team: st.team, anchor: st.anchor, ex: meEx, isMe: true, pat: st.pattern, manual: st.manual }];
  st.members.forEach((m) => {
    const dp = m.ex && m.ex._p ? decPattern(m.ex._p) : null;
    if (dp) {
      list.push({ id: m.id, name: m.name, team: m.team, anchor: dp.anchor, ex: m.ex, isMe: false, pat: dp.pat, manual: manualFromEx(m.ex) });
    } else {
      list.push({ id: m.id, name: m.name, team: m.team, anchor: fromIdx(idx(st.base3) + (m.team - 1)), ex: m.ex, isMe: false, pat: THREE, manual: {} });
    }
  });
  return list;
}

export interface MEff { pos: number; base: 'duty' | 'off'; kind: Kind; works: boolean; l: string; label: string; post: boolean }

export function mEff(p: Person, s: string): MEff {
  const bd = baseDay(p.pat, p.anchor, p.manual, s);
  const prev = baseDay(p.pat, p.anchor, p.manual, fromIdx(idx(s) - 1));
  const base: 'duty' | 'off' = bd.w ? 'duty' : 'off';
  const t = p.ex[s];
  let kind: Kind = base;
  let works = bd.w;
  if (t === 'leave') { kind = 'leave'; works = false; }
  else if (t === 'edu') { kind = 'edu'; works = false; }
  else if (t === 'swap') { kind = 'swap'; works = !bd.w; }
  return { pos: bd.pos, base, kind, works, l: bd.l, label: longLabel(bd.l), post: prev.w };
}

/** 쉬는 날(근무도 교육도 아님)이면 true. 연가·비번은 가능으로 봅니다. */
export function mFree(p: Person, s: string, skipPost: boolean): boolean {
  const e = mEff(p, s);
  if (e.works || e.kind === 'edu') return false;
  if (skipPost && e.post && e.kind === 'off') return false;
  return true;
}

export function nextDuty(st: AppState, today: string): { iso: string; days: number } | null {
  const t = idx(today);
  for (let i = 1; i <= 120; i++) {
    const s = fromIdx(t + i);
    if (eff(st, s).works) return { iso: s, days: i };
  }
  return null;
}

export interface LedgerRow {
  who: string;
  net: number;
  items: { iso: string; covered: boolean }[];
}

export function ledger(st: AppState): LedgerRow[] {
  const map: Record<string, LedgerRow> = {};
  Object.keys(st.ex).sort().forEach((s) => {
    const e = st.ex[s];
    if (e.type !== 'swap' || !e.who) return;
    const covered = baseDay(st.pattern, st.anchor, st.manual, s).w;
    const key = e.who.trim();
    if (!map[key]) map[key] = { who: key, net: 0, items: [] };
    map[key].net += covered ? -1 : 1;
    map[key].items.push({ iso: s, covered });
  });
  return Object.keys(map).map((k) => map[k]);
}

export interface MeetDay { iso: string; busy: Person[] }

export function meetDays(
  st: AppState, off: Record<string, boolean>, range: number, skipPost: boolean, today: string,
): { ms: Person[]; full: MeetDay[]; one: MeetDay[] } {
  const ms = roster(st).filter((x) => !off[x.id]);
  const t0 = idx(today) + 1;
  const full: MeetDay[] = [];
  const one: MeetDay[] = [];
  for (let i = 0; i < range; i++) {
    const s = fromIdx(t0 + i);
    const busy = ms.filter((m) => !mFree(m, s, skipPost));
    if (!busy.length) full.push({ iso: s, busy: [] });
    else if (busy.length === 1 && ms.length >= 3) one.push({ iso: s, busy });
  }
  return { ms, full, one };
}

export interface MeetItem { id: string; final: string; title: string; group: string }

/** 내가 들어간 모든 소모임에서 확정된 모임 */
export function allMeets(st: AppState): MeetItem[] {
  const out: MeetItem[] = [];
  const add = (group: string, polls: Poll[]): void => {
    polls.forEach((p) => { if (p.final) out.push({ id: p.id, final: p.final, title: p.title, group }); });
  };
  add(st.cloud ? st.cloud.name : '', st.polls);
  (st.others || []).forEach((g) => add(g.name, g.polls));
  return out;
}

export const hasManyGroups = (st: AppState): boolean => !!st.cloud && (st.others || []).length > 0;
