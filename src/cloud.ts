import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { encPattern } from './lib/shift';
import { AppState, Member, Poll } from './types';

export const cloudConfigured = (): boolean => SUPABASE_URL.indexOf('https://') === 0 && SUPABASE_KEY.length > 20;

async function req(method: string, path: string, body?: unknown, prefer?: string): Promise<unknown> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
  };
  // 예전 방식(eyJ...로 시작하는 JWT) 키는 Authorization에도 넣고, 새 방식(sb_publishable_...) 키는 apikey만 보냅니다.
  if (SUPABASE_KEY.indexOf('sb_') !== 0) headers.Authorization = 'Bearer ' + SUPABASE_KEY;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/' + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(res.status + ' ' + text.slice(0, 160));
  return text ? JSON.parse(text) : null;
}

const enc = encodeURIComponent;

const rpc = (fn: string, args: Record<string, unknown>): Promise<unknown> => req('POST', 'rpc/' + fn, args);

/** 사용 횟수 합계만 올립니다. 누가 눌렀는지는 보내지 않습니다. */
export async function bumpUsage(kind: string): Promise<void> {
  await rpc('bump_usage', { p_kind: kind });
}

export async function getTeam(code: string): Promise<{ code: string; name: string; base: string; kind?: 'team' | 'meet'; pair?: boolean } | null> {
  const r = (await rpc('get_team', { p_code: code })) as { code: string; name: string; base: string; kind?: string; pair?: boolean } | null;
  return r ? { ...r, kind: r.kind === 'meet' ? 'meet' : 'team', pair: r.pair === true } : null;
}

/** 서버에 종류 함수(create_team_k)가 아직 없으면 예전 함수로 만들고 종류는 이 폰에만 둡니다. */
export async function createTeam(code: string, name: string, base: string, kind: 'team' | 'meet' = 'team'): Promise<void> {
  try {
    await rpc('create_team_k', { p_code: code, p_name: name, p_base: base, p_kind: kind });
  } catch (e) {
    if (!/PGRST202|404/.test(String(e))) throw e;
    await rpc('create_team', { p_code: code, p_name: name, p_base: base });
  }
}

export async function setTeamPair(code: string, pair: boolean): Promise<void> {
  await rpc('set_team_pair', { p_code: code, p_pair: pair });
}

export async function setTeamKind(code: string, kind: 'team' | 'meet'): Promise<void> {
  await rpc('set_team_kind', { p_code: code, p_kind: kind });
}

export async function upsertMember(code: string, m: { id: string; name: string; team: number; anchor: string; ex: Record<string, string> }): Promise<void> {
  await rpc('upsert_member', { p_code: code, p_id: m.id, p_name: m.name, p_team: m.team, p_anchor: m.anchor, p_ex: m.ex });
}

export async function deleteMember(code: string, id: string): Promise<void> {
  await rpc('delete_member', { p_code: code, p_id: id });
}

export async function insertPoll(code: string, p: { id: string; title: string; dates: string[] }): Promise<void> {
  await rpc('insert_poll', { p_code: code, p_id: p.id, p_title: p.title, p_dates: p.dates });
}

export async function updatePoll(code: string, id: string, patch: { final?: string; dates?: string[]; title?: string }): Promise<void> {
  await rpc('update_poll', {
    p_code: code, p_id: id,
    p_final: patch.final === undefined ? null : patch.final,
    p_dates: patch.dates === undefined ? null : patch.dates,
    p_title: patch.title === undefined ? null : patch.title,
  });
}

export async function deletePoll(code: string, id: string): Promise<void> {
  await rpc('delete_poll', { p_code: code, p_id: id });
}

export async function upsertVote(code: string, pollId: string, memberId: string, dates: string[]): Promise<void> {
  await rpc('upsert_vote', { p_code: code, p_poll_id: pollId, p_member_id: memberId, p_dates: dates });
}

interface MemberRow { id: string; name: string; team: number; ex: Record<string, string> }
interface PollRow { id: string; title: string; dates: string[]; final: string; created_at: string }
interface VoteRow { poll_id: string; member_id: string; dates: string[] }

/** 서버의 팀원·투표를 내려받아 앱 상태에 그대로 반영할 모양으로 만듭니다. */
export async function fetchTeam(code: string, myId: string): Promise<{ members: Member[]; polls: Poll[]; meStillThere: boolean; kind?: 'team' | 'meet'; pair?: boolean }> {
  const r = (await rpc('fetch_team', { p_code: code })) as { kind?: string; pair?: boolean; members: MemberRow[]; polls: PollRow[]; votes: VoteRow[] };
  const mrows = r.members || [];
  const prows = r.polls || [];
  const vrows = r.votes || [];
  const polls: Poll[] = prows.map((p) => ({ id: p.id, title: p.title, dates: p.dates, final: p.final, at: Date.parse(p.created_at) || 0, votes: {} }));
  const byId: Record<string, Poll> = {};
  polls.forEach((p) => { byId[p.id] = p; });
  vrows.forEach((v) => {
    const p = byId[v.poll_id];
    if (p) p.votes[v.member_id === myId ? 'me' : v.member_id] = v.dates;
  });
  const members: Member[] = mrows.filter((m) => m.id !== myId).map((m) => ({ id: m.id, name: m.name, team: m.team, ex: m.ex || {} }));
  return { members, polls, meStillThere: mrows.some((m) => m.id === myId), kind: r.kind === 'meet' ? 'meet' : r.kind === 'team' ? 'team' : undefined, pair: typeof r.pair === 'boolean' ? r.pair : undefined };
}

const mapTeam = (r: { kind?: string; pair?: boolean; members: MemberRow[]; polls: PollRow[]; votes: VoteRow[] }, myId: string): { members: Member[]; polls: Poll[]; meStillThere: boolean; kind?: 'team' | 'meet'; pair?: boolean } => {
  const mrows = r.members || [];
  const prows = r.polls || [];
  const vrows = r.votes || [];
  const polls: Poll[] = prows.map((p) => ({ id: p.id, title: p.title, dates: p.dates, final: p.final, at: Date.parse(p.created_at) || 0, votes: {} }));
  const byId: Record<string, Poll> = {};
  polls.forEach((p) => { byId[p.id] = p; });
  vrows.forEach((v) => {
    const p = byId[v.poll_id];
    if (p) p.votes[v.member_id === myId ? 'me' : v.member_id] = v.dates;
  });
  const members: Member[] = mrows.filter((m) => m.id !== myId).map((m) => ({ id: m.id, name: m.name, team: m.team, ex: m.ex || {} }));
  return { members, polls, meStillThere: mrows.some((m) => m.id === myId), kind: r.kind === 'meet' ? 'meet' : r.kind === 'team' ? 'team' : undefined, pair: typeof r.pair === 'boolean' ? r.pair : undefined };
};

/** 서버 함수 fetch_team_v2가 아직 없으면(SQL 미적용) true. 이 경우 예전 방식으로 대신 받습니다. */
let noV2 = false;

/**
 * 바뀐 게 없으면 데이터를 내려받지 않습니다. prevHash는 지난번에 받은 해시(없으면 '').
 * 바뀌지 않았으면 null, 바뀌었으면 새 데이터와 해시를 돌려줍니다.
 */
export async function fetchTeamIfChanged(code: string, myId: string, prevHash: string): Promise<{ hash: string; data: { members: Member[]; polls: Poll[]; meStillThere: boolean; kind?: 'team' | 'meet'; pair?: boolean } } | null> {
  if (!noV2) {
    try {
      const r = (await rpc('fetch_team_v2', { p_code: code, p_hash: prevHash })) as { same: boolean; hash: string; data?: { kind?: string; pair?: boolean; members: MemberRow[]; polls: PollRow[]; votes: VoteRow[] } };
      if (r.same) return null;
      return { hash: r.hash, data: mapTeam(r.data || { members: [], polls: [], votes: [] }, myId) };
    } catch (e) {
      // 함수가 없을 때(404/PGRST202)만 예전 방식으로 전환. 그 외 오류(네트워크 등)는 그대로 던집니다.
      if (!/PGRST202|404/.test(String(e))) throw e;
      noV2 = true;
    }
  }
  return { hash: '', data: await fetchTeam(code, myId) };
}

export function myProfile(st: AppState, since: string, nick?: string): { name: string; team: number; anchor: string; ex: Record<string, string> } | null {
  if (!st.cloud) return null;
  const ex: Record<string, string> = {};
  Object.keys(st.ex).forEach((k) => { if (k >= since) ex[k] = st.ex[k].type; });
  ex._p = encPattern(st.pattern, st.anchor);
  if (st.pattern.t === 'manual') Object.keys(st.manual).forEach((k) => { if (k >= since) ex['b:' + k] = st.manual[k]; });
  return { name: nick || st.nick || '나', team: st.team, anchor: st.anchor, ex };
}

/** 한글 초대 코드 추천: 예) 용감한호랑이27 */
export function genCode(): string {
  const A = ['용감한', '든든한', '씩씩한', '빠른', '푸른', '붉은', '힘센', '의리있는', '날쌘', '듬직한'];
  const B = ['호랑이', '독수리', '소방차', '불꽃', '사자', '늑대', '파도', '매', '곰', '고래'];
  const n = Math.floor(Math.random() * 90) + 10;
  return A[Math.floor(Math.random() * A.length)] + B[Math.floor(Math.random() * B.length)] + n;
}

/** 입력한 코드를 정리합니다. 영문만이면 대문자로, 한글은 그대로. */
export function normCode(v: string): string {
  const t = v.replace(/\s+/g, '');
  return /^[A-Za-z0-9]+$/.test(t) ? t.toUpperCase() : t;
}

export const validCode = (v: string): boolean => /^[가-힣A-Za-z0-9]{2,12}$/.test(v);
