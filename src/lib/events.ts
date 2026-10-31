import { AppState, Poll } from '../types';

/** 팀 일정 종류. 서버 구조를 바꾸지 않으려고, 투표(모임) 항목의 제목 앞에 [직장교육] 같은 말머리를 붙여 저장합니다. */
export type EvKind = 'plain' | 'edu' | 'dinner' | 'etc' | 'meet';

export const EV_KINDS: { k: Exclude<EvKind, 'meet'>; tag: string; label: string; short: string }[] = [
  { k: 'plain', tag: '[일정]', label: '일정', short: '일' },
  // 아래 세 가지는 예전 버전에서 올린 일정을 알아보기 위해 남겨 둡니다.
  { k: 'edu', tag: '[직장교육]', label: '직장교육', short: '교' },
  { k: 'dinner', tag: '[회식]', label: '회식', short: '회' },
  { k: 'etc', tag: '[기타]', label: '기타', short: '기' },
];

/** 일정 색 (근무 색인 붉은색·초록·보라·남색과 겹치지 않게) */
export const EV_COLOR: Record<EvKind, string> = {
  plain: '#0E7C86',
  edu: '#0E7C86',
  dinner: '#B45309',
  etc: '#6B7280',
  meet: '#BE185D',
};

export interface EvItem { id: string; kind: EvKind; name: string; short: string; color: string; label: string }

export function eventTitle(k: Exclude<EvKind, 'meet'>, name: string): string {
  const e = EV_KINDS.find((x) => x.k === k) as (typeof EV_KINDS)[number];
  return e.tag + ' ' + name;
}

/** 말머리가 붙어 있고 날짜가 확정된 항목이면 "팀 일정"입니다. (투표 목록에서는 숨깁니다.) */
export function parseEvent(p: Poll): { kind: Exclude<EvKind, 'meet'>; name: string } | null {
  if (!p.final) return null;
  for (const e of EV_KINDS) {
    if (p.title.indexOf(e.tag) === 0) return { kind: e.k, name: p.title.slice(e.tag.length).trim() || e.label };
  }
  return null;
}

export function isEventPoll(p: Poll): boolean {
  return parseEvent(p) !== null;
}

/** 날짜별 팀 일정 + 투표로 확정된 모임 */
export function eventsByDate(polls: Poll[]): Record<string, EvItem[]> {
  const out: Record<string, EvItem[]> = {};
  const put = (d: string, it: EvItem): void => { (out[d] = out[d] || []).push(it); };
  polls.forEach((p) => {
    if (!p.final) return;
    const ev = parseEvent(p);
    if (ev) {
      const meta = EV_KINDS.find((x) => x.k === ev.kind) as (typeof EV_KINDS)[number];
      const short = ev.kind === 'plain' ? ev.name.slice(0, 1) || meta.short : meta.short;
      p.dates.forEach((d) => put(d, { id: p.id, kind: ev.kind, name: ev.name, short, color: EV_COLOR[ev.kind], label: meta.label }));
    } else {
      put(p.final, { id: p.id, kind: 'meet', name: p.title, short: '모', color: EV_COLOR.meet, label: '모임' });
    }
  });
  return out;
}

/** 소모임이 둘 이상일 때 소모임별 점 색. 근무 색(붉은·초록·남색)·모임(분홍)과 겹치지 않게 골랐습니다. */
export const GROUP_COLORS = ['#0E7C86', '#B45309', '#6B7F1A', '#546E7A', '#9C4F96'];

export interface GroupEv { name: string; color: string; group: string; kind: EvKind }

/** 내가 들어간 모든 소모임의 팀 일정(모임 제외)을 날짜별로 모읍니다. 소모임이 둘 이상이면 소모임별 색과 이름을 붙입니다. */
export function groupEvents(st: AppState): Record<string, GroupEv[]> {
  const grp: { code: string; name: string; polls: Poll[] }[] = [];
  if (st.cloud) grp.push({ code: st.cloud.code, name: st.cloud.name, polls: st.polls });
  (st.others || []).forEach((g) => grp.push({ code: g.code, name: g.name, polls: g.polls }));
  const many = grp.length > 1;
  const codes = grp.map((g) => g.code).sort();
  const out: Record<string, GroupEv[]> = {};
  grp.forEach((g) => {
    const gc = GROUP_COLORS[codes.indexOf(g.code) % GROUP_COLORS.length];
    const by = eventsByDate(g.polls);
    Object.keys(by).forEach((d) => by[d].forEach((x) => {
      if (x.kind === 'meet') return;
      (out[d] = out[d] || []).push({ name: x.name, color: many ? gc : x.color, group: many ? g.name : '', kind: x.kind });
    }));
  });
  return out;
}

/** 내 폰에만 있는 개인 일정의 점 색 */
export const PERSONAL_COLOR = '#475569';

export function personalByDate(list: { id: string; name: string; dates: string[] }[] | undefined): Record<string, { id: string; name: string }[]> {
  const out: Record<string, { id: string; name: string }[]> = {};
  (list || []).forEach((e) => e.dates.forEach((d) => { (out[d] = out[d] || []).push({ id: e.id, name: e.name }); }));
  return out;
}
