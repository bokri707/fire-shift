import { AppState, Group } from '../types';

const PREFIX = 'FIRESHIFT1:';

/** 내 기록을 한 덩어리 글자로 만듭니다. (팀원·투표는 서버에 있으니 넣지 않고, 소모임 코드와 내 번호표만 넣습니다.) */
export function makeBackup(st: AppState): string {
  const ex: AppState['ex'] = {};
  Object.keys(st.ex).forEach((k) => { if (!st.ex[k].sample) ex[k] = st.ex[k]; });
  const pick = {
    team: st.team, anchor: st.anchor, pattern: st.pattern, manual: st.manual, base3: st.base3,
    configured: st.configured, nick: st.nick, ex, myPolls: st.myPolls || [],
    cloud: st.cloud,
    others: (st.others || []).map((g) => ({ code: g.code, name: g.name, myId: g.myId, nick: g.nick })),
  };
  return PREFIX + JSON.stringify(pick);
}

/** 붙여넣은 글자가 올바른 백업이면 그 안의 내용을, 아니면 오류 문구를 돌려줍니다. */
export function readBackup(text: string): { ok: true; data: Record<string, unknown> } | { ok: false; err: string } {
  const t = text.trim();
  const i = t.indexOf(PREFIX);
  if (i < 0) return { ok: false, err: '백업 글자가 아닙니다. "FIRESHIFT1:"로 시작하는 글자를 통째로 붙여넣어 주세요.' };
  try {
    const d = JSON.parse(t.slice(i + PREFIX.length)) as Record<string, unknown>;
    const pat = d.pattern as { t?: unknown; d?: unknown } | undefined;
    if (!d || typeof d.anchor !== 'string' || typeof d.team !== 'number' || !d.ex || typeof d.ex !== 'object' || !pat || !Array.isArray(pat.d)) {
      return { ok: false, err: '백업 내용이 올바르지 않습니다. 글자가 중간에 잘리지 않았는지 확인해 주세요.' };
    }
    return { ok: true, data: d };
  } catch (e) {
    return { ok: false, err: '백업 글자가 중간에 잘린 것 같습니다. 처음부터 끝까지 통째로 붙여넣어 주세요.' };
  }
}

/** 백업 내용을 현재 상태에 적용합니다. 같은 소모임이면 이미 받아 둔 팀원·투표는 그대로 둡니다. */
export function applyBackup(s: AppState, d: Record<string, unknown>): AppState {
  const b = d as unknown as Partial<AppState> & { others?: { code: string; name: string; myId: string; nick?: string }[] };
  const cloud = b.cloud || null;
  const same = !!cloud && !!s.cloud && s.cloud.code === cloud.code;
  const others: Group[] = (b.others || []).map((g) => {
    const cur = (s.others || []).find((o) => o.code === g.code);
    return { code: g.code, name: g.name, myId: g.myId, nick: g.nick, members: cur ? cur.members : [], polls: cur ? cur.polls : [] };
  });
  return {
    ...s,
    team: b.team as number, anchor: b.anchor as string, pattern: b.pattern as AppState['pattern'],
    manual: b.manual || {}, base3: b.base3 || s.base3, configured: b.configured !== false, nick: b.nick || '',
    ex: b.ex as AppState['ex'], myPolls: b.myPolls || [],
    cloud,
    members: cloud ? (same ? s.members : []) : s.members.filter((m) => !m.sample),
    polls: cloud ? (same ? s.polls : []) : s.polls,
    others,
  };
}
