import { bumpUsage, cloudConfigured } from '../cloud';

export type UsageKind = 'open' | 'cal' | 'team' | 'pair' | 'set';

let off = false;

/** 하루 단위 사용 횟수(합계)만 올립니다. 개인을 알아볼 수 있는 값은 보내지 않고, 실패해도 앱에는 영향이 없습니다. */
export function bump(kind: UsageKind): void {
  if (off || !cloudConfigured()) return;
  bumpUsage(kind).catch((e: unknown) => {
    if (/PGRST202|404/.test(String(e))) off = true;
  });
}
