import { SITE_URL } from '../config';

interface Loc { origin?: string; search?: string }

const loc = (): Loc => (globalThis as unknown as { location?: Loc }).location || {};

/** 웹에서 주소에 붙은 ?code=초대코드 를 읽습니다. */
export function codeFromUrl(): string {
  const m = /[?&]code=([^&#]+)/.exec(loc().search || '');
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch (e) { return ''; }
}

/** 초대 코드가 들어간 바로 열리는 주소. 웹이면 지금 주소를, 앱이면 config의 SITE_URL을 씁니다. */
export function inviteLink(code: string): string {
  const o = loc().origin;
  const base = o && o.indexOf('http') === 0 ? o : SITE_URL.replace(/\/+$/, '');
  return base ? base + '/?code=' + encodeURIComponent(code) : '';
}

/** 가입을 마치면 주소의 ?code= 를 지웁니다. */
export function clearCodeFromUrl(): void {
  const g = globalThis as unknown as { history?: { replaceState?: (a: unknown, b: string, c: string) => void }; location?: { pathname?: string } };
  try { if (g.history && g.history.replaceState) g.history.replaceState(null, '', (g.location && g.location.pathname) || '/'); } catch (e) { /* 무시 */ }
}
