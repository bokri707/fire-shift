import { useEffect } from 'react';
import { AppState as RNAppState } from 'react-native';
import { fetchTeam, myProfile, upsertMember } from './cloud';
import { fromIdx, idx } from './lib/date';
import { sync, useStore } from './store';

/** 들어가 있는 모든 소모임의 팀원·투표를 2.5초마다 받아오고, 내 근무 정보가 바뀌면 모든 소모임에 올립니다. */
export default function CloudSync(): null {
  const { state, update, today, reportErr, markSynced } = useStore();
  const list: { code: string; myId: string; nick: string }[] = [];
  if (state.cloud) list.push({ code: state.cloud.code, myId: state.cloud.myId, nick: state.cloud.nick || state.nick });
  (state.others || []).forEach((g) => list.push({ code: g.code, myId: g.myId, nick: g.nick || state.nick }));
  const key = list.map((g) => g.code + ':' + g.myId).join('|');
  const nickKey = JSON.stringify(list.map((g) => [g.code, g.myId, g.nick]));

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    const groups = key.split('|').map((x) => { const i = x.lastIndexOf(':'); return { code: x.slice(0, i), myId: x.slice(i + 1) }; });
    const tick = async (): Promise<void> => {
      if (Date.now() - sync.lastWrite < 1500) return;
      try {
        const results = await Promise.all(groups.map(async (g) => ({ g, r: await fetchTeam(g.code, g.myId) })));
        if (!alive || Date.now() - sync.lastWrite < 1500) return;
        update((s) => {
          let next = s;
          results.forEach(({ g, r }) => {
            if (next.cloud && next.cloud.code === g.code) {
              if (JSON.stringify(next.members) === JSON.stringify(r.members) && JSON.stringify(next.polls) === JSON.stringify(r.polls)) return;
              next = { ...next, members: r.members, polls: r.polls };
            } else if (next.others) {
              const cur = next.others.find((o) => o.code === g.code);
              if (!cur) return;
              if (JSON.stringify(cur.members) === JSON.stringify(r.members) && JSON.stringify(cur.polls) === JSON.stringify(r.polls)) return;
              next = { ...next, others: next.others.map((o) => (o.code === g.code ? { ...o, members: r.members, polls: r.polls } : o)) };
            }
          });
          return next;
        });
        reportErr('');
        markSynced();
      } catch (e) {
        if (alive) reportErr('서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.');
      }
    };
    tick();
    const h = setInterval(tick, 2500);
    const sub = RNAppState.addEventListener('change', (st) => { if (st === 'active') tick(); });
    return () => { alive = false; clearInterval(h); sub.remove(); };
  }, [key, update, reportErr, markSynced]);

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
