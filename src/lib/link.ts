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

interface Web { navigator?: { userAgent?: string }; location?: { href?: string }; sessionStorage?: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } }
const web = (): Web => globalThis as unknown as Web;

/** 카카오톡 안의 브라우저로 열었는지 (여기서는 저장된 정보가 쉽게 사라집니다) */
export function inKakaoBrowser(): boolean {
  const ua = (web().navigator && web().navigator!.userAgent) || '';
  return /KAKAOTALK/i.test(ua);
}

/** 카카오톡 브라우저에서 지금 주소를 기본 브라우저(크롬 등)로 다시 엽니다. */
export function openInExternalBrowser(): void {
  const w = web();
  const href = (w.location && w.location.href) || '';
  if (!href || !w.location) return;
  w.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(href);
}

/** 카카오톡 브라우저면 한 번만 자동으로 외부 브라우저로 넘깁니다. */
export function autoLeaveKakao(): void {
  if (!inKakaoBrowser()) return;
  const ss = web().sessionStorage;
  try {
    if (ss && ss.getItem('fs-ext') === '1') return;
    if (ss) ss.setItem('fs-ext', '1');
  } catch (e) { /* 저장 불가면 그냥 진행 */ }
  openInExternalBrowser();
}
