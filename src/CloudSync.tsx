import { useEffect, useRef } from 'react';
import { AppState as RNAppState } from 'react-native';
import { fetchTeamIfChanged, myProfile, upsertMember } from './cloud';
import { fromIdx, idx } from './lib/date';
import { sync, useStore } from './store';

/** 화면(탭)별 서버 확인 간격(밀리초). 0이면 확인하지 않습니다. */
const POLL_MS: Record<string, number> = {
  team: 6000, // 투표·팀원을 보는 화면: 비교적 자주
  cal: 45000, // 달력만 볼 때: 가끔
  set: 0, // 설정 화면: 안 함
};

/**
 * 들어가 있는 모든 소모임의 팀원·투표를 받아오고, 내 근무 정보가 바뀌면 모든 소모임에 올립니다.
 * 비용 절약 원칙:
 *  - 앱이 화면에 보일 때(active)만 서버를 확인합니다. 백그라운드·꺼진 화면에서는 요청 0.
 *  - 화면(탭)에 따라 확인 간격을 다르게 합니다.
 *  - 서버에 마지막으로 받은 해시를 보내서, 바뀐 게 없으면 데이터를 내려받지 않습니다.
 */
export default function CloudSync({ tab }: { tab: string }): null {
  const { state, update, today, reportErr, markSynced } = useStore();
  const list: { code: string; myId: string; nick: string }[] = [];
  if (state.cloud) list.push({ code: state.cloud.code, myId: state.cloud.myId, nick: state.cloud.nick || state.nick });
  (state.others || []).forEach((g) => list.push({ code: g.code, myId: g.myId, nick: g.nick || state.nick }));
  const key = list.map((g) => g.code + ':' + g.myId).join('|');
  const nickKey = JSON.stringify(list.map((g) => [g.code, g.myId, g.nick]));
  const hashes = useRef<Record<string, string>>({});
  const ms = POLL_MS[tab] === undefined ? POLL_MS.cal : POLL_MS[tab];

  useEffect(() => {
    if (!key || ms === 0) return undefined;
    let alive = true;
    let h: ReturnType<typeof setInterval> | null = null;
    const groups = key.split('|').map((x) => { const i = x.lastIndexOf(':'); return { code: x.slice(0, i), myId: x.slice(i + 1) }; });
    const tick = async (): Promise<void> => {
      if (RNAppState.currentState !== 'active') return;
      if (Date.now() - sync.lastWrite < 1500) return;
      try {
        const results = await Promise.all(groups.map(async (g) => ({ g, r: await fetchTeamIfChanged(g.code, g.myId, hashes.current[g.code] || '') })));
        if (!alive || Date.now() - sync.lastWrite < 1500) return;
        const changed = results.filter((x) => x.r !== null) as { g: { code: string; myId: string }; r: NonNullable<(typeof results)[number]['r']> }[];
        if (changed.length) {
          update((s) => {
            let next = s;
            changed.forEach(({ g, r }) => {
              hashes.current[g.code] = r.hash;
              if (next.cloud && next.cloud.code === g.code) {
                if (JSON.stringify(next.members) === JSON.stringify(r.data.members) && JSON.stringify(next.polls) === JSON.stringify(r.data.polls)) return;
                next = { ...next, members: r.data.members, polls: r.data.polls };
              } else if (next.others) {
                const cur = next.others.find((o) => o.code === g.code);
                if (!cur) return;
                if (JSON.stringify(cur.members) === JSON.stringify(r.data.members) && JSON.stringify(cur.polls) === JSON.stringify(r.data.polls)) return;
                next = { ...next, others: next.others.map((o) => (o.code === g.code ? { ...o, members: r.data.members, polls: r.data.polls } : o)) };
              }
            });
            return next;
          });
        }
        reportErr('');
        markSynced();
      } catch (e) {
        if (alive) reportErr('서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.');
      }
    };
    const start = (): void => { if (h === null) h = setInterval(tick, ms); };
    const stop = (): void => { if (h !== null) { clearInterval(h); h = null; } };
    if (RNAppState.currentState === 'active') { tick(); start(); }
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') { tick(); start(); } else stop();
    });
    return () => { alive = false; stop(); sub.remove(); };
  }, [key, ms, update, reportErr, markSynced]);

  // 내가 쓰는 소모임이 바뀌면 해시 기억을 정리합니다(없어진 코드의 해시가 남지 않게).
  useEffect(() => {
    const codes = key ? key.split('|').map((x) => x.slice(0, x.lastIndexOf(':'))) : [];
    Object.keys(hashes.current).forEach((c) => { if (codes.indexOf(c) < 0) delete hashes.current[c]; });
  }, [key]);

  const prof = JSON.stringify(myProfile(state, fromIdx(idx(today) - 7)));
  useEffect(() => {
    if (!key || prof === 'null') return undefined;
    const p = JSON.parse(prof) as { name: string; team: number; anchor: string; ex: Record<string, string> };
    const groups = JSON.parse(nickKey) as [string, string, string][];
    const h = setTimeout(() => {
      groups.forEach(([code, myId, nick]) => {
        upsertMember(code, { id: myId, ...p, name: nick || p.name }).catch(() => reportErr('내 근무 정보를 서버에 올리지 못했습니다.'));
      });
    }, 700);
    return () => clearTimeout(h);
  }, [key, nickKey, prof, reportErr]);

  return null;
}
